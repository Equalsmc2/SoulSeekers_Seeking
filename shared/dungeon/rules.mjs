/** Extracted/normalized from DM Dungeon Commander R05.4 source. Server-safe, no DOM. */
export const ROOM_SIZE=960;
export const GRID_LIMIT=25;
export const DEAL={room:16,tarot:5,poker:6};
export const REDRAW_CREDITS=8, REDRAW_BATCH_LIMIT=3;
export const ROOM_COUNTS={entry:1,straight:7,bend:4,junction:3,cross:3,storage:3,pillars:3,barricade:2,laboratory:2,vault:5,hall:2,crypt:2,arena:2,fork:1};
export const ROOM_TYPES=[
 ['entry','Party Entrance',15,'entry',[]],
 ['straight','Long Passage',5,'stone',[[-245,-220,135,160],[155,70,150,150]]],
 ['bend','Corner Room',3,'stone',[[-260,105,170,160],[145,-240,145,135]]],
 ['junction','Three-way Hall',11,'stone',[[160,125,150,165]]],
 ['cross','Grand Junction',15,'tile',[[-245,-250,120,120],[145,-250,120,120],[-245,145,120,120],[145,145,120,120]]],
 ['storage','Supply Storage',5,'stone',[[-300,-265,170,120],[135,-265,170,120],[-305,145,180,120],[145,155,165,125]]],
 ['pillars','Column Court',15,'tile',[[-215,-210,105,110],[110,-210,105,110],[-215,100,105,110],[110,100,105,110]]],
 ['barricade','Rubble Chamber',5,'stone',[[-300,-55,145,160],[165,-55,120,150]]],
 ['laboratory','Workroom',10,'tile',[[-285,-250,160,165],[115,100,180,170]]],
 ['vault','End Vault',4,'tile',[[-270,-230,170,165],[125,-230,150,165]]],
 ['hall','Great Chamber',15,'tile',[[-300,-285,150,150],[160,155,165,160]]],
 ['crypt','Crypt',3,'stone',[[-305,-270,150,160],[160,130,150,160]]],
 ['arena','Open Arena',15,'stone',[[-300,-285,105,110],[205,180,95,100]]],
 ['fork','Split Gallery',7,'tile',[[-280,130,150,135],[155,-275,155,135]]],
].map(([id,name,doors,pattern,ob])=>({id,name,doors,pattern,ob}));
export const ROOM_LOOKUP=Object.fromEntries(ROOM_TYPES.map(r=>[r.id,r]));
export const TAROT=[
 ['fool','0 · The Fool','Quick footwork; Party gains speed here.','fleet',1.16],
 ['magician','I · The Magician','Camp units deal more damage.','damage',1.22],
 ['priestess','II · High Priestess','Capture is quieter and faster for Party.','partyCapture',1.28],
 ['empress','III · The Empress','Party heals slowly on these floors.','heal',1.6],
 ['emperor','IV · The Emperor','Monster reinforcements are tougher.','hp',1.34],
 ['hierophant','V · Hierophant','Party capture becomes harder.','dmCapture',1.26],
 ['lovers','VI · The Lovers','Active DM camps spawn faster.','spawn',.80],
 ['chariot','VII · The Chariot','Camp monsters move faster.','speed',1.25],
 ['strength','VIII · Strength','Camp monsters gain HP.','hp',1.23],
 ['hermit','IX · The Hermit','Camp spawning slows.','spawn',1.35],
 ['wheel','X · Wheel of Fortune','Camp spawns more rapidly.','spawn',.68],
 ['justice','XI · Justice','Monsters hit harder in this chamber.','damage',1.16],
 ['hanged','XII · The Hanged Man','Party movement slowed in this room.','slow',.77],
 ['death','XIII · Death','Room drains Party health every second.','hurt',1.8],
 ['temperance','XIV · Temperance','Room gently heals the Party.','heal',.9],
 ['devil','XV · The Devil','Strong and fast monsters.','devil',1.15],
 ['tower','XVI · The Tower','Crackling hazard damages Party.','hurt',2.5],
 ['star','XVII · The Star','Sanctuary heals Party rapidly.','heal',2.4],
 ['moon','XVIII · The Moon','Party has trouble claiming camps.','dmCapture',1.45],
 ['sun','XIX · The Sun','Party can capture camps faster.','partyCapture',1.45],
 ['judgement','XX · Judgement','Both sides capture more quickly.','bothCapture',1.32],
 ['world','XXI · The World','Monsters endure more damage.','hp',1.16],
].map(([id,name,desc,effect,power])=>({id,name,desc,effect,power}));
export const SUITS={S:{glyph:'♠',name:'Spades',type:'stalker'},H:{glyph:'♥',name:'Hearts',type:'grunt'},D:{glyph:'♦',name:'Diamonds',type:'ranger'},C:{glyph:'♣',name:'Clubs',type:'brute'}};
export const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export function pokerInfo(id){const suit=SUITS[id?.[0]],rank=id?.slice(1);if(!suit||!RANKS.includes(rank))return null;const tier=Math.min(4,1+Math.floor((RANKS.indexOf(rank))/4));return {id,rank,suit,monster:suit.type,tier,units:tier,interval:Math.max(5.8,13-tier*1.7),cap:2+tier*2};}
export const CHARS=[
 {name:'ASYA',role:'Sorcerer / Aberrant Mind'},
 {name:'ALEXANDRA',role:'Rogue / Arcane Trickster'},
 {name:'VETERAN',role:'Warlock / Undead'},
 {name:'DEBTOR',role:'Warlock / Cult Debt'},
 {name:'JEANETTE',role:'Cleric / Wedding Photographer'},
 {name:'CHEMIST',role:'Artificer / Long Range Support'},
];
export const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
export const xy=(x,y)=>`${x},${y}`;
export function coords(key){const [x,y]=String(key).split(',').map(Number);return [x,y];}
export function validXY(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&Math.abs(x)<=GRID_LIMIT&&Math.abs(y)<=GRID_LIMIT;}
export function doors(room){const base=ROOM_LOOKUP[room.id]?.doors??0;let mask=0;for(let d=0;d<4;d++)if(base&(1<<d))mask|=1<<((d+room.rot)%4);return mask;}
export function connected(board){const entry=Object.keys(board).find(k=>board[k].id==='entry');if(!entry)return new Set();const seen=new Set([entry]),queue=[entry];while(queue.length){const k=queue.shift(),[x,y]=coords(k),a=board[k];for(let d=0;d<4;d++){const [dx,dy]=DIRECTIONS[d],nk=xy(x+dx,y+dy),b=board[nk];if(b&&!seen.has(nk)&&(doors(a)&(1<<d))&&(doors(b)&(1<<((d+2)%4)))){seen.add(nk);queue.push(nk);}}}return seen;}
export function mayPlace(board,x,y,room,skip=null){if(!validXY(x,y))return 'Outside the dungeon bounds';const at=xy(x,y);if(board[at]&&at!==skip)return 'That square is occupied';const actual=Object.keys(board).filter(k=>k!==skip);if(!actual.length)return room.id==='entry'?null:'Place the Entrance first';if(room.id==='entry'&&!skip)return 'Only one Entrance is allowed';let doorsMatched=false,neighbors=0;for(let d=0;d<4;d++){const [dx,dy]=DIRECTIONS[d],nk=xy(x+dx,y+dy);if(nk===skip)continue;const other=board[nk];if(!other)continue;neighbors++;const own=Boolean(doors(room)&(1<<d)),their=Boolean(doors(other)&(1<<((d+2)%4)));if(own!==their)return 'Doorways do not match: rotate or change square';if(own)doorsMatched=true;}if(!neighbors&&!(!actual.length&&skip))return 'Rooms must connect to the dungeon';return doorsMatched||!actual.length?null:'No connected doorway';}
export function dungeonValidation(board){const ids=Object.keys(board),souls=ids.filter(k=>board[k].soul),seen=connected(board),issues=[];if(!ids.length)issues.push('Place the Entrance to begin');else{if(!ids.some(k=>board[k].id==='entry'))issues.push('Missing Entrance');if(ids.some(k=>!seen.has(k)))issues.push('Rooms disconnected from Entrance');if(souls.length!==7)issues.push('Place exactly seven souls in different rooms');if(souls.some(k=>!seen.has(k)))issues.push('Soul outside reachable rooms');}return {ready:issues.length===0,issues,souls:souls.length,reachable:seen.size};}
