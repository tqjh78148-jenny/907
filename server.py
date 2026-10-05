# -*- coding: utf-8 -*-
"""
新北市立頭前國中 907班 會考成績與落點查詢系統 本機伺服器
執行方式：雙擊執行本程式或在命令列執行 python server.py
會自動開啟瀏覽器前往查詢首頁
"""
import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    os.chdir(DIRECTORY)
    url = f"http://localhost:{PORT}/index.html"
    print("=" * 60)
    print("【新北市立頭前國中 907班 會考落點與弱點診斷系統】")
    print(f"伺服器已啟動於：{url}")
    print("系統包含：907班全班31位學生資料、各科弱點分析、林群數學落點預估、頭前國中出發之大眾運輸通勤時間。")
    print("按 Ctrl + C 可關閉伺服器。")
    print("=" * 60)
    
    # 自動開啟預設瀏覽器
    webbrowser.open(url)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n伺服器已停止。")

if __name__ == "__main__":
    run()
