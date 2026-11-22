//
//  main.swift
//  YouTube Ad Skipper
//
//  Minimal host app for the Safari Web Extension.
//  Opening it shows a small window with setup instructions.
//

import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {

    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildWindow()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    private func buildWindow() {
        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 380),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        win.title = "YouTube Ad Skipper"
        win.center()
        win.isReleasedWhenClosed = false

        let container = NSView(frame: win.contentView!.bounds)
        container.autoresizingMask = [.width, .height]

        // Title
        let title = NSTextField(labelWithString: "YouTube Ad Skipper")
        title.font = NSFont.systemFont(ofSize: 22, weight: .bold)
        title.frame = NSRect(x: 30, y: 310, width: 460, height: 30)
        container.addSubview(title)

        let subtitle = NSTextField(labelWithString: "Automatic ad skipping for YouTube in Safari")
        subtitle.font = NSFont.systemFont(ofSize: 13)
        subtitle.textColor = .secondaryLabelColor
        subtitle.frame = NSRect(x: 30, y: 288, width: 460, height: 20)
        container.addSubview(subtitle)

        // Instructions
        let steps = """
        To turn the extension on:

          1.  Click “Open Safari Settings” below.
          2.  Go to the Extensions tab.
          3.  Tick “YouTube Ad Skipper”.
          4.  Allow it to access youtube.com when Safari asks.

        Note: Safari needs “Allow Unsigned Extensions” enabled in the
        Develop menu (Develop ▸ Allow Unsigned Extensions). If you do not
        see a Develop menu, enable it under Safari Settings ▸ Advanced ▸
        “Show features for web developers”.
        """

        let body = NSTextField(wrappingLabelWithString: steps)
        body.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        body.frame = NSRect(x: 30, y: 110, width: 460, height: 165)
        container.addSubview(body)

        // Button
        let button = NSButton(
            title: "Open Safari Settings",
            target: self,
            action: #selector(openSafariSettings)
        )
        button.bezelStyle = .rounded
        button.keyEquivalent = "\r"
        button.frame = NSRect(x: 30, y: 40, width: 200, height: 32)
        container.addSubview(button)

        let quitButton = NSButton(
            title: "Quit",
            target: NSApp,
            action: #selector(NSApplication.terminate(_:))
        )
        quitButton.bezelStyle = .rounded
        quitButton.frame = NSRect(x: 240, y: 40, width: 90, height: 32)
        container.addSubview(quitButton)

        win.contentView = container
        win.makeKeyAndOrderFront(nil)
        self.window = win
    }

    @objc private func openSafariSettings() {
        // Safari 14+ opens the Extensions pane directly from this URL.
        let urls = [
            "x-apple.systempreferences:com.apple.Safari-Settings.extension",
            "x-apple.systempreferences:com.apple.Safari-Settings"
        ]
        for s in urls {
            if let u = URL(string: s), NSWorkspace.shared.open(u) {
                return
            }
        }
        // Fallback: just activate Safari
        if let safari = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") {
            NSWorkspace.shared.open(safari)
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
