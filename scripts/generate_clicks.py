import wave
import math
import struct
import random
import os

def save_wav(filename, data, sample_rate=44100):
    with wave.open(filename, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        for val in data:
            val = max(-1.0, min(1.0, val))
            sample = int(val * 32767)
            w.writeframes(struct.pack('<h', sample))

def generate_mechanical():
    data = []
    for i in range(int(44100 * 0.03)):
        t = i / 44100
        env = math.exp(-t * 250)
        sine = math.sin(2 * math.pi * 1200 * t)
        noise = random.uniform(-0.3, 0.3)
        data.append((sine + noise) * env * 0.5)
    return data

def generate_woodblock():
    data = []
    for i in range(int(44100 * 0.08)):
        t = i / 44100
        env = math.exp(-t * 90)
        sine1 = math.sin(2 * math.pi * 900 * t)
        sine2 = math.sin(2 * math.pi * 1400 * t)
        data.append((0.6 * sine1 + 0.4 * sine2) * env * 0.7)
    return data

def generate_stick():
    data = []
    for i in range(int(44100 * 0.04)):
        t = i / 44100
        env = math.exp(-t * 180)
        sine = math.sin(2 * math.pi * 2000 * t)
        noise = random.uniform(-1.0, 1.0)
        data.append((0.4 * sine + 0.6 * noise) * env * 0.5)
    return data

def generate_cowbell():
    data = []
    for i in range(int(44100 * 0.2)):
        t = i / 44100
        env = math.exp(-t * 25)
        sq1 = 1.0 if math.sin(2 * math.pi * 540 * t) > 0 else -1.0
        sq2 = 1.0 if math.sin(2 * math.pi * 800 * t) > 0 else -1.0
        data.append((0.5 * sq1 + 0.5 * sq2) * env * 0.25)
    return data

if __name__ == '__main__':
    os.makedirs('public', exist_ok=True)
    save_wav('public/mechanical.wav', generate_mechanical())
    save_wav('public/woodblock.wav', generate_woodblock())
    save_wav('public/stick.wav', generate_stick())
    save_wav('public/cowbell.wav', generate_cowbell())
    print("Click sound samples generated successfully!")
