// Stand-ins for WarmButton/JourneyNavigationSkin: keep the real IslandJourneyOverlay button contract (bind(fn) runs fn on tap).
export const pressed=new Map();
export function warmButton(n){return {addContent(){},bind(fn){n.__press=fn;pressed.set(n.name,n);}};}
export function applyJourneyNavigationSkin(){}
export function warmButtonGraphics(){}
