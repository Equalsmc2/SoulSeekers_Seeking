import {randomInt,randomUUID} from 'node:crypto';
import {ROOM_COUNTS,TAROT,SUITS,RANKS,DEAL,REDRAW_CREDITS,REDRAW_BATCH_LIMIT,mayPlace,connected,dungeonValidation,xy,coords,validXY,ROOM_LOOKUP,pokerInfo} from './rules.mjs';
const clone=x=>structuredClone(x);
const shuffle=(v,rand=randomInt)=>{for(let i=v.length-1;i>0;i--){const j=rand(i+1);[v[i],v[j]]=[v[j],v[i]]}return v};
const newCard=(kind,id,rot=0)=>({uid:randomUUID(),kind,id,...(kind==='room'?{rot}:{})});
export class DungeonSession{
 constructor({random=randomInt}={}){this.random=random;this.round=0;this.reset();}
 reset(){this.round++;this.phase='BUILD';this.version=0;this.board={};this.discard={room:[],tarot:[],poker:[]};this.deck={
   room:shuffle(Object.entries(ROOM_COUNTS).flatMap(([id,num])=>id==='entry'?[]:Array.from({length:num},()=>newCard('room',id,this.random(4)))),this.random),
   tarot:shuffle(TAROT.map(t=>newCard('tarot',t.id)),this.random),
   poker:shuffle(Object.keys(SUITS).flatMap(s=>RANKS.map(r=>newCard('poker',s+r))),this.random)
 };this.hand={room:[newCard('room','entry',0)],tarot:[],poker:[]};
 for(const kind of ['room','tarot','poker'])while(this.hand[kind].length<DEAL[kind])this.hand[kind].push(this.deck[kind].pop());
 this.redrawCredits=REDRAW_CREDITS;this.undoStack=[];this.version++;}
 snapshot(role){const main={phase:this.phase,round:this.round,version:this.version,roomCount:Object.keys(this.board).length,soulCount:Object.values(this.board).filter(r=>r.soul).length,validation:this.phase==='BUILD'?dungeonValidation(this.board):{ready:true,issues:[],souls:7,reachable:Object.keys(this.board).length}};
 if(role!=='dm')return {phase:this.phase,round:this.round,version:this.version};return {...main,board:clone(this.board),hand:clone(this.hand),deckCounts:Object.fromEntries(Object.entries(this.deck).map(([k,v])=>[k,v.length])),discardCounts:Object.fromEntries(Object.entries(this.discard).map(([k,v])=>[k,v.length])),redrawCredits:this.redrawCredits,undoDepth:this.undoStack.length};}
 take(){return clone({board:this.board,hand:this.hand,deck:this.deck,discard:this.discard,redrawCredits:this.redrawCredits});}
 restore(state){for(const field of ['board','hand','deck','discard','redrawCredits'])this[field]=clone(state[field]);}
 commit(){this.version++;}
 save(){this.undoStack.push(this.take());if(this.undoStack.length>48)this.undoStack.shift();}
 requireBuild(){if(this.phase!=='BUILD')throw Error('Dungeon editing is only allowed during BUILD');}
 findCard(kind,uid){if(!this.hand[kind]||typeof uid!=='string')throw Error('Invalid card/deck');const index=this.hand[kind].findIndex(c=>c.uid===uid);if(index<0)throw Error('That card is not in your hand');return {index,card:this.hand[kind][index]};}
 rotateCard({cardUid}){this.requireBuild();const {card}=this.findCard('room',cardUid);card.rot=(card.rot+1)%4;this.commit();}
 placeRoom({cardUid,x,y}){this.requireBuild();const {index,card}=this.findCard('room',cardUid);const err=mayPlace(this.board,x,y,card);if(err)throw Error(err);this.save();this.board[xy(x,y)]={id:card.id,rot:card.rot,cardUid:card.uid,soul:false,tarot:null,camp:null};this.hand.room.splice(index,1);this.commit();}
 rotateRoom({key}){this.requireBuild();const r=this.board[key];if(!r)throw Error('Room not found');const [x,y]=coords(key);const next={...r,rot:(r.rot+1)%4};const candidate={...this.board,[key]:next};if(!connected(candidate).size||connected(candidate).size!==Object.keys(candidate).length)throw Error('Rotation would disconnect dungeon');const err=mayPlace(this.board,x,y,next,key);if(err)throw Error(err);this.save();r.rot=next.rot;this.commit();}
 moveRoom({key,x,y}){this.requireBuild();const r=this.board[key];if(!r)throw Error('Room not found');if(!validXY(x,y))throw Error('Invalid destination');if(key===xy(x,y))return;
 const candidate=clone(this.board);delete candidate[key];const err=mayPlace(candidate,x,y,r,key);if(err)throw Error(err);candidate[xy(x,y)]=r;if(connected(candidate).size!==Object.keys(candidate).length)throw Error('Move would disconnect dungeon');this.save();this.board=candidate;this.commit();}
 removeRoom({key}){this.requireBuild();const r=this.board[key];if(!r)throw Error('Room not found');const candidate={...this.board};delete candidate[key];if(r.id==='entry'&&Object.keys(candidate).length)throw Error('Remove other rooms before Entrance');if(Object.keys(candidate).length&&connected(candidate).size!==Object.keys(candidate).length)throw Error('Removing this room would orphan other rooms');
 this.save();this.board=candidate;this.hand.room.push({kind:'room',uid:r.cardUid,id:r.id,rot:r.rot});if(r.tarot)this.hand.tarot.push(r.tarot);if(r.camp)this.hand.poker.push(r.camp);this.commit();}
 applyTarot({cardUid,key}){this.requireBuild();const r=this.board[key];if(!r)throw Error('Room not found');const {index,card}=this.findCard('tarot',cardUid);this.save();this.hand.tarot.splice(index,1);if(r.tarot)this.hand.tarot.push(r.tarot);r.tarot=card;this.commit();}
 placeCamp({cardUid,key}){this.requireBuild();const r=this.board[key];if(!r||r.id==='entry')throw Error('Camps require a non-Entrance room');const {index,card}=this.findCard('poker',cardUid);if(!pokerInfo(card.id))throw Error('Invalid poker card');this.save();this.hand.poker.splice(index,1);if(r.camp)this.hand.poker.push(r.camp);r.camp=card;this.commit();}
 clearSpecial({kind,key}){this.requireBuild();if(!['tarot','poker'].includes(kind))throw Error('Invalid deck');const r=this.board[key],slot=kind==='tarot'?'tarot':'camp';if(!r||!r[slot])throw Error('No card to clear');this.save();this.hand[kind].push(r[slot]);r[slot]=null;this.commit();}
 placeSoul({key}){this.requireBuild();const r=this.board[key];if(!r||r.id==='entry')throw Error('Souls belong in non-Entrance rooms');const souls=Object.values(this.board).filter(e=>e.soul).length;if(!r.soul&&souls===7)throw Error('Seven souls already placed');this.save();r.soul=!r.soul;this.commit();}
 rerollSelected({selections}){this.requireBuild();if(!Array.isArray(selections)||selections.length<1||selections.length>REDRAW_BATCH_LIMIT)throw Error('Choose one to three cards');if(selections.length>this.redrawCredits)throw Error('Not enough redraw credits');const seen=new Set(),byKind={room:0,tarot:0,poker:0},found=[];
 for(const s of selections){const kind=s?.kind,uid=s?.cardUid;if(!Object.hasOwn(byKind,kind)||typeof uid!=='string'||seen.has(uid))throw Error('Invalid or duplicate card selection');seen.add(uid);const {card}=this.findCard(kind,uid);if(kind==='room'&&card.id==='entry')throw Error('Entrance may not be rerolled');byKind[kind]++;found.push({kind,uid});}
 for(const [kind,n] of Object.entries(byKind))if(n>this.deck[kind].length)throw Error(`Not enough ${kind} reserve cards`);
 // As in R05.4, redraws are deliberately not undoable. A prior undo cannot refund them.
 this.undoStack=[];for(const {kind,uid} of found){const i=this.hand[kind].findIndex(c=>c.uid===uid);this.discard[kind].push(this.hand[kind][i]);this.hand[kind][i]=this.deck[kind].pop();}
 this.redrawCredits-=found.length;this.commit();}
 undoRoom(){this.requireBuild();if(!this.undoStack.length)throw Error('No edit to undo');this.restore(this.undoStack.pop());this.commit();}
 lockDungeon(){this.requireBuild();const v=dungeonValidation(this.board);if(!v.ready)throw Error('Cannot lock: '+v.issues.join('; '));this.phase='LOCKED';this.undoStack=[];this.commit();}
 unlockDungeon(){if(this.phase!=='LOCKED')throw Error('Dungeon is not locked');this.phase='BUILD';this.commit();}
}
