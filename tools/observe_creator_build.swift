import Cocoa
import Foundation
import Darwin
// Build only this isolated Creator project. Observe foreground; never activate it.
guard let base=ProcessInfo.processInfo.environment["QF_PROJECT_ROOT"], !base.isEmpty else { fputs("Set QF_PROJECT_ROOT to an isolated checkout.\n", stderr); exit(2) }
guard let executable=ProcessInfo.processInfo.environment["QF_CREATOR_EXECUTABLE"], !executable.isEmpty else { fputs("Set QF_CREATOR_EXECUTABLE to the verified Creator executable.\n", stderr); exit(2) }
let prefix=base+"/evidence/dot-candidate-validation-20261010/build/creator"
FileManager.default.createFile(atPath:prefix+".log",contents:nil)
let output=try FileHandle(forWritingTo:URL(fileURLWithPath:prefix+".log"))
let process=Process();process.executableURL=URL(fileURLWithPath:executable);process.arguments=["--project",base+"/creator-build-project","--build","configPath="+base+"/tools/wechat-world-r6-audio-build-options.json"]
process.standardOutput=output;process.standardError=output
let start=Date();var reason="completed";var samples:[[String:Any]]=[]
try process.run()
while process.isRunning {
 let front=NSWorkspace.shared.frontmostApplication
 samples.append(["utc":ISO8601DateFormatter().string(from:Date()),"frontmostPid":front?.processIdentifier ?? -1,"frontmostName":front?.localizedName ?? "unknown"])
 if front?.bundleURL?.path.contains("CocosCreator.app")==true {reason="STOP_CREATOR_FOREGROUND";process.terminate();break}
 if Date().timeIntervalSince(start)>300 {reason="STOP_TIMEOUT";process.terminate();break}
 Thread.sleep(forTimeInterval:0.05)
}
let limit=Date().addingTimeInterval(3)
while process.isRunning && Date()<limit {Thread.sleep(forTimeInterval:0.05)}
if process.isRunning {kill(process.processIdentifier,SIGKILL)}
process.waitUntilExit();try output.close()
let report:[String:Any]=["reason":reason,"exitCode":process.terminationStatus,"seconds":Date().timeIntervalSince(start),"samples":samples,"noSystemInputOrActivation":true]
try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:prefix+"-monitor.json"))
print("build reason=\(reason) exit=\(process.terminationStatus) seconds=\(Date().timeIntervalSince(start))")
exit(reason=="completed" ? process.terminationStatus : 3)
