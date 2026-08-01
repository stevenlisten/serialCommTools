#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""串口模拟设备：向指定 COM 口发送已知测试数据（真实链路自测用）
用法: python serial_sim.py --port COM11 --baud 115200 [--burst N] [--once]
"""
import argparse
import serial
import time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="COM11")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--burst", type=int, default=0, help="连续突发字节数（0=关闭）")
    ap.add_argument("--once", action="store_true", help="发送一轮后退出")
    args = ap.parse_args()

    ser = serial.Serial(args.port, args.baud, timeout=1)
    print(f"[sim] opened {args.port} @ {args.baud}")

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

    if args.once:
        round_once()
        print("[sim] done (once)")
        ser.close()
        return

    # 持续发送模式：供浏览器连接后接收
    try:
        while True:
            round_once()
            if args.burst:
                chunk = b"B" * args.burst
                ser.write(chunk)
                print(f"[sim] burst {args.burst} bytes")
                time.sleep(0.5)
            else:
                time.sleep(2)
    except KeyboardInterrupt:
        pass
    finally:
        ser.close()
        print("[sim] closed")


if __name__ == "__main__":
    main()