import serial, sys, time
s = serial.Serial('COM11', 115200, timeout=3)
data = s.read(64)
open(r'C:/tools/serial_rx_result.bin','wb').write(data)
s.close()
print("RXOK", data)