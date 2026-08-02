#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""真机测试·命令驱动串口模拟设备（COM11 对端）
用法: python -u tools/realmachine_sim.py --port COM11 --baud 115200
stdin 命令（一行一条，完成回显 [sim] ok <cmd>）：
  send <name>        发送命名模式
  repeat <name> <n>  连续发送 n 次
  partial <name> <n> 只发送模式前 n 字节
  bytes <hex>        发送原始字节（空格分隔十六进制）
  bulk <n>           发送 n 行 "L%06d\n"（日志上限测试）
  oneline <n>        发送单行 n 字节 'A' + \n
  burst <n>          发送约 n 字节（每行 1024 字节 'R' 填充 + \n）
  onebyte <n>        逐字节发送 n 次（每次 1 字节）
  stream on|off      后台每 2 秒发送 hello
  idle <n>           等待 n 秒（期间持续读对端）
  reset              清空接收记录
  dump               写接收记录到 C:\tools\serial_rx_result.bin
  rxlen              打印接收字节数
  quit               退出
"""
import argparse, os, sys, threading, time
import serial

RX_LOG = r"C:\tools\serial_rx_result.bin"
rx = bytearray()
rx_lock = threading.Lock()

P = {
  "hello": b"HELLO-FROM-SIM\n",
  "zh_utf8": "\u4e2d\u6587\u6d4b\u8bd5\u6570\u636e\u884c\n".encode("utf-8"),
  "zh_gbk": "GBK\u884c-\u4e2d\u6587\u7f16\u7801\n".encode("gbk"),
  "alert": b"ALERT: temperature high\n",
  "alert5": b"ALERT: temperature high\n" * 5,
  "html": b"<script>alert(1)</script>\n<img src=x onerror=alert(2)>\n",
  "regex": b".*+?^$()[]{}\\|/ special\n",
  "mixed_eol": b"a\r\nb\rc\nd\n",
  "empty_lines": b"x\n\n\ny\n",
  "filter_alpha": b"alpha beta\nalpha only\nnothing here\n",
  "filter_cn": "\u4e2d\u6587\u5173\u952e\u5b57\u884c\n".encode("utf-8"),
  "filter_html": b"<b>&amp;\"quote\"</b> line\n",
  "case_test": b"CaseTest line\n",
  "latin1": bytes([0xE4, 0xE9, 0x0A]),          # äé
  "invalid_utf8": b"\xff\xfe invalid\n",
  "allbytes": bytes(range(256)) + b"\n",
  "zeros": b"\x00" * 100,
  "ffs": b"\xff" * 100,
  "bom_utf8": b"\xef\xbb\xbf" + "\u4e2d\u6587BOM\u884c\n".encode("utf-8"),
  "bom_repeat": (b"\xef\xbb\xbf" + "\u4e2d\u6587BOM\u884c1\n".encode("utf-8")
                 + b"\xef\xbb\xbf" + "\u4e2d\u6587BOM\u884c2\n".encode("utf-8")
                 + b"\xef\xbb\xbf" + "\u4e2d\u6587BOM\u884c3\n".encode("utf-8")),
  "bom_split": (b"\xef\xbb", b"\xbf" + "\u4e2d\u6587BOM\u8de8\u5757\n".encode("utf-8")),
  "split_utf8": (b"\xe4\xb8", b"\xad" + "\u6587UTF8\u8de8\u5757\n".encode("utf-8")),
  "gbk_split": (b"\xd6", b"\xd0" + "\u6587GBK\u8de8\u5757\n".encode("gbk")),
  "split_utf8_half": (b"\xe4\xb8",),             # "中" 的前 2 字节，余下重连后发送
  "split_utf8_rest": b"\xad" + "\u6587\u91cd\u8fde\u540e\u5b8c\u6574\n".encode("utf-8"),
  "no_newline": b"PUN",
  "newline": b"\n",
  "txmark": b"TX-LOG\n",
}


def send_pattern(name, n=1, partial=None):
    pat = P[name]
    chunks = pat if isinstance(pat, tuple) else (pat,)
    out = b""
    for c in chunks:
        if partial is not None:
            take = min(partial, len(c))
            out += c[:take]
            partial -= take
        else:
            out += c
    if not out:
        print("[sim] empty pattern", flush=True)
        return
    for _ in range(n):
        if isinstance(pat, tuple):
            for c in chunks:
                ser.write(c)
                time.sleep(0.3)
        else:
            ser.write(out)
        time.sleep(0.01)
    print(f"[sim] sent {name} x{n}", flush=True)


def reader_loop():
    while not stop_event.is_set():
        try:
            if ser.in_waiting:
                data = ser.read(ser.in_waiting)
                with rx_lock:
                    rx.extend(data)
                print(f"[sim] rx {len(data)} bytes (total {len(rx)})", flush=True)
        except Exception as e:
            print(f"[sim] rx err {e}", flush=True)
        time.sleep(0.02)


def stream_loop():
    while not stop_event.is_set():
        if stream_on[0]:
            try:
                ser.write(P["hello"])
            except Exception as e:
                print(f"[sim] stream err {e}", flush=True)
        time.sleep(2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="COM11")
    ap.add_argument("--baud", type=int, default=115200)
    args = ap.parse_args()
    global ser, stop_event, stream_on
    ser = serial.Serial(args.port, args.baud, timeout=0.1)
    stop_event = threading.Event()
    stream_on = [False]
    threading.Thread(target=reader_loop, daemon=True).start()
    threading.Thread(target=stream_loop, daemon=True).start()
    print(f"[sim] ready {args.port} @ {args.baud}", flush=True)
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            cmd = parts[0]
            try:
                if cmd == "send" and len(parts) >= 2:
                    send_pattern(parts[1])
                elif cmd == "repeat" and len(parts) >= 3:
                    send_pattern(parts[1], int(parts[2]))
                elif cmd == "partial" and len(parts) >= 3:
                    send_pattern(parts[1], 1, int(parts[2]))
                elif cmd == "bytes" and len(parts) >= 2:
                    ser.write(bytes(int(x, 16) for x in parts[1:]))
                    print(f"[sim] bytes {len(parts)-1}", flush=True)
                elif cmd == "bulk" and len(parts) >= 2:
                    n = int(parts[1])
                    buf = ("L%06d\n" * n) % tuple(range(n))
                    data = buf.encode("ascii")
                    for i in range(0, len(data), 65536):
                        ser.write(data[i:i + 65536])
                        time.sleep(0.01)
                    print(f"[sim] bulk {n} lines", flush=True)
                elif cmd == "oneline" and len(parts) >= 2:
                    n = int(parts[1])
                    out = b"A" * n + b"\n"
                    for i in range(0, len(out), 65536):
                        ser.write(out[i:i + 65536])
                        time.sleep(0.01)
                    print(f"[sim] oneline {n}", flush=True)
                elif cmd == "burst" and len(parts) >= 2:
                    n = int(parts[1])
                    line = b"R" * 1023 + b"\n"
                    out = line * (n // 1024)
                    out += b"R" * (n % 1024)
                    # 慢速流式（每 1KB 间隔 3ms）：避免 VSPE 缓冲背压卡死，浏览器可实时消费
                    for i in range(0, len(out), 1024):
                        ser.write(out[i:i + 1024])
                        time.sleep(0.003)
                    print(f"[sim] burst {len(out)}", flush=True)
                elif cmd == "onebyte" and len(parts) >= 2:
                    n = int(parts[1])
                    for i in range(n):
                        ser.write(bytes([0x41 + i % 26]))
                        time.sleep(0.002)
                    print(f"[sim] onebyte {n}", flush=True)
                elif cmd == "stream":
                    stream_on[0] = parts[1] == "on"
                    print(f"[sim] stream {parts[1]}", flush=True)
                elif cmd == "idle" and len(parts) >= 2:
                    time.sleep(int(parts[1]))
                    print(f"[sim] idle done", flush=True)
                elif cmd == "reset":
                    with rx_lock:
                        rx.clear()
                    print("[sim] rx reset", flush=True)
                elif cmd == "dump":
                    with rx_lock:
                        with open(RX_LOG, "wb") as f:
                            f.write(bytes(rx))
                    print(f"[sim] dumped {len(rx)}", flush=True)
                elif cmd == "rxlen":
                    print(f"[sim] rxlen {len(rx)}", flush=True)
                elif cmd == "quit":
                    print("[sim] quit", flush=True)
                    break
                else:
                    print(f"[sim] unknown cmd: {line}", flush=True)
                print("[sim] ok " + cmd, flush=True)
            except Exception as e:
                print(f"[sim] err {e}", flush=True)
                print("[sim] ok " + cmd, flush=True)
    finally:
        stop_event.set()
        ser.close()
        print("[sim] closed", flush=True)


if __name__ == "__main__":
    main()
