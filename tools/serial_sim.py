#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""串口模拟设备：向指定 COM 口发送已知测试数据，并记录收到的数据（真实链路自测用）
用法: python serial_sim.py --port COM11 --baud 115200 [--once]
收到的字节追加写入 C:\tools\serial_rx_result.bin（上限 1MB）
"""
import argparse
import os
import serial
import time

RX_LOG = r"C:\tools\serial_rx_result.bin"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="COM11")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    if os.path.exists(RX_LOG):
        os.remove(RX_LOG)

    ser = serial.Serial(args.port, args.baud, timeout=0.2)
    print(f"[sim] opened {args.port} @ {args.baud}", flush=True)

    patterns = [
        b"HELLO-FROM-SIM-2026\n",
        "中文测试数据行\n".encode("utf-8"),
        "GBK行-中文编码\n".encode("gbk"),
        b"ALERT: temperature high\n",
        bytes([0x00, 0x01, 0x02, 0xFE, 0xFF, 0x0D, 0x0A]),
        b"plain ascii line\n",
    ]

    def round_once():
        for p in patterns:
            ser.write(p)
            time.sleep(0.15)

    try:
        if args.once:
            round_once()
            print("[sim] done (once)", flush=True)
            return
        end = time.time() + 60  # 最长运行 60 秒
        while time.time() < end:
            round_once()
            # 读取对端（浏览器）发来的数据并记录
            try:
                n = ser.in_waiting
                if n:
                    data = ser.read(n)
                    if os.path.exists(RX_LOG) and os.path.getsize(RX_LOG) > 1048576:
                        os.remove(RX_LOG)
                    with open(RX_LOG, "ab") as f:
                        f.write(data)
                    print(f"[sim] rx {len(data)} bytes", flush=True)
            except Exception as e:
                print(f"[sim] rx err {e}", flush=True)
            time.sleep(2)
        print("[sim] timeout", flush=True)
    except KeyboardInterrupt:
        pass
    finally:
        ser.close()
        print("[sim] closed", flush=True)


if __name__ == "__main__":
    main()