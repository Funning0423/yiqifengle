import Foundation
import ApplicationServices
guard AXIsProcessTrusted() else { exit(2) }
let data=try Data(contentsOf: URL(fileURLWithPath:CommandLine.arguments[1]))
let route=(try JSONSerialization.jsonObject(with:data) as! [[String:Any]])[0]["actions"] as! [[Any]]
for action in route {
 guard action[0] as! String == "swap" else {exit(3)}
 for value in action.dropFirst() {
  let i=value as! Int,p=CGPoint(x:993+Double(i%7)*39.2,y:371+Double(i/7)*39.2)
  CGEvent(mouseEventSource:nil,mouseType:.mouseMoved,mouseCursorPosition:p,mouseButton:.left)?.post(tap:.cghidEventTap);usleep(80000)
  CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:p,mouseButton:.left)?.post(tap:.cghidEventTap);usleep(100000)
  CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:p,mouseButton:.left)?.post(tap:.cghidEventTap);usleep(600000)
 }
 print("Native swap",action)
}
