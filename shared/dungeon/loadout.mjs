/** Server-owned, immutable-after-start Party loadout. Values are V22.4 zero-based slots. */
export function validateLoadout(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isInteger(value.weapon)||!Number.isInteger(value.dodge)||![0,1].includes(value.weapon)||![0,1].includes(value.dodge))throw Error('Choose exactly one weapon and one dodge before readying');
 return {weapon:value.weapon,dodge:value.dodge};
}
