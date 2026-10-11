import Foundation
import CoreGraphics
let entries = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let matched = entries.filter { row in let name = row[kCGWindowOwnerName as String] as? String ?? ""; return name.contains("开发者") || name.lowercased().contains("wechatwebdev") }
let result: [String: Any] = ["screenCaptureAlreadyAuthorized": CGPreflightScreenCaptureAccess(), "windows": matched]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
