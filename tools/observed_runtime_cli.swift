import Cocoa
import Foundation
import CoreGraphics
import Darwin
let args=Array(CommandLine.arguments.dropFirst()),prefix=args[0],command=Array(args.dropFirst())
let expected="QFFirstOpen-20261010T084620701Z-adad-e429da-default"
let project="/var/folders/mj/mrt0w4m97fb6xs3g4rsj5b8w0000gn/T/qf-first-open/"+expected
func snapshot()->[String:Any]{
 let rows=CGWindowListCopyWindowInfo([.optionAll,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] ?? []
 let windows=rows.filter { r in let owner=r[kCGWindowOwnerName as String] as? String ?? "";return owner.contains("开发者") || owner.lowercased().contains("wechatwebdev") }
 let target=windows.filter{($0[kCGWindowName as String] as? String)==expected}
 let named=windows.filter{!($0[kCGWindowName as String] as? String ?? "").isEmpty}
 return ["utc":ISO8601DateFormatter().string(from:Date()),"frontmostPid":NSWorkspace.shared.frontmostApplication?.processIdentifier ?? -1,"targetWindows":target.count,"targetVisible":target.contains{($0[kCGWindowIsOnscreen as String] as? Bool)==true},"wechatNamedWindows":named.count,"wechatProjectWindows":named.filter{($0[kCGWindowName as String] as? String) != "项目列表"}.count,"targetPid":target.first?[kCGWindowOwnerPID as String] ?? -1]
}
let allowed=["automation_evaluate","automation_game_action","simulator_screenshot","simulator_refresh","get_simulator_console"]
guard command.count>2,command[0]=="-c",command[1]=="codex",allowed.contains(command[2]),let pi=command.firstIndex(of:"--project"),command.indices.contains(pi+1),command[pi+1]==project else{exit(4)}
let cfg=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:project+"/project.config.json"))) as! [String:Any]
guard cfg["appid"] as? String=="wx3bdd911c5c06f591",cfg["projectname"] as? String==expected else{exit(5)}
let baseline=snapshot();var final=baseline,reason="completed",count=0
func same(_ s:[String:Any])->Bool{(s["targetWindows"] as? Int)==1 && (s["wechatProjectWindows"] as? Int)==1 && (s["frontmostPid"] as? Int)==(baseline["frontmostPid"] as? Int) && (s["targetPid"] as? Int)==(baseline["targetPid"] as? Int)}
if !same(baseline){reason="STOP_WINDOW_IDENTITY"}else{
 FileManager.default.createFile(atPath:prefix+"-output.txt",contents:nil);let out=try FileHandle(forWritingTo:URL(fileURLWithPath:prefix+"-output.txt"))
 let p=Process();p.executableURL=URL(fileURLWithPath:"/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide");p.arguments=command;p.standardOutput=out;p.standardError=out
 try p.run();let start=Date()
 while p.isRunning{final=snapshot();count+=1;if !same(final){reason="STOP_FOREGROUND_OR_WINDOW_CHANGE";p.terminate();break};if Date().timeIntervalSince(start)>25{reason="STOP_TIMEOUT";p.terminate();break};Thread.sleep(forTimeInterval:0.05)}
 let deadline=Date().addingTimeInterval(2);while p.isRunning && Date()<deadline{Thread.sleep(forTimeInterval:0.05)};if p.isRunning{kill(p.processIdentifier,SIGKILL)};p.waitUntilExit();try out.close();if reason=="completed" && p.terminationStatus != 0{reason="CLI_FAILED"}
}
let result:[String:Any]=["baseline":baseline,"final":final,"reason":reason,"samplesCount":count,"noSystemInputOrActivation":true]
let data=try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]);try data.write(to:URL(fileURLWithPath:prefix+"-monitor.json"));print(String(data:data,encoding:.utf8)!);exit(reason=="completed" ? 0 : 3)
