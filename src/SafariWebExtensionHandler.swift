//
//  SafariWebExtensionHandler.swift
//  YouTube Ad Skipper Extension
//
//  Native message handler for the Safari Web Extension.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem

        #if os(macOS)
        let message = item?.userInfo?[SFExtensionMessageKey]
        #else
        let message = item?.userInfo?["message"]
        #endif

        os_log(.default, "[YT Ad Skipper] message from JS: %@",
               String(describing: message))

        let response = NSExtensionItem()
        #if os(macOS)
        response.userInfo = [ SFExtensionMessageKey: [ "ok": true ] ]
        #else
        response.userInfo = [ "message": [ "ok": true ] ]
        #endif

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
