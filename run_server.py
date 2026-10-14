# -*- coding: utf-8 -*-
"""
新北市立頭前國民中學 - 定期評量成績查詢與管理系統
本機伺服器快速啟動腳本
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("=" * 60)
        print("  新北市立頭前國民中學 - 定期評量成績查詢與管理系統")
        print(f"  伺服器已啟動: {url}")
        print("  正在為您開啟瀏覽器...")
        print("  提示：若要停止伺服器，請在此視窗按下 Ctrl + C")
        print("=" * 60)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n伺服器已正常停止。")

if __name__ == '__main__':
    run()
