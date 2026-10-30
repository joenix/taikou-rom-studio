"""Run native function probes using a supplied debug libretro core and a save COPY.
Usage: python probe-map-engine.py ROM REPORT EMULATOR_PY CORE SAVE_STATE
Requires the emulator module's numpy/Pillow dependencies. No files are modified.
This tests routines, not playability or save compatibility.
"""
import ctypes as C
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
rom, report_path, emulator_path, core, state_path = map(Path, sys.argv[1:6])
report = json.loads(report_path.read_text())
assert hashlib.sha256(rom.read_bytes()).hexdigest() == report['outputSha256']
original_state = state_path.read_bytes()
os.environ['CORE'] = str(core)
sys.argv = [sys.argv[0], str(rom)]
spec = importlib.util.spec_from_file_location('emulator', emulator_path)
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)
assert e.lib.retro_unserialize(C.create_string_buffer(original_state), len(original_state))
e.lib.m68k_set_reg.argtypes = [C.c_int, C.c_uint]
reg = e.lib.m68k_set_reg
# The native idle loop at 0xeda permits deterministic bounded function calls.
def call(pc, args):
    reg(17, 0x2000)
    reg(15, 0xffed00)
    e.write(0xffed00, (0xeda).to_bytes(4, 'big') + b''.join(x.to_bytes(4, 'big') for x in args))
    reg(16, pc)
    for _ in range(12):
        e.run(1)
        if e.regs()[16] in (0xeda, 0xedc):
            break
    assert e.regs()[16] in (0xeda, 0xedc), hex(e.regs()[16])
    assert e.regs()[15] == 0xffed04
    return e.regs()[0] & 255
actor = 0xffed40
location = report['location']
source = bytes.fromhex(report['entry'])[:4]
target = bytes.fromhex(report['entry'])[4:]
if report.get('mode') == 'disable':
    for pc,args in [(0xf98a,[actor]),(0xf9f0,[actor,0])]:
        e.write(actor,b'\0'*60);e.write(actor+2,source);call(pc,args)
        assert e.read(actor+2,4)==source,hex(pc)
    call(0xf914,[report['townBase']]);returned=e.regs()[0]&65535
    assert returned==65535,hex(returned)
    assert state_path.read_bytes()==original_state
    print(json.dumps(dict(entry_disabled_native=True,return_lookup=hex(returned),safe_deletion=False,save_unchanged=True),indent=2))
    sys.exit(0)
rows=[]
# Test both native town-entry consumers and the direction flag lookup.
for pc, args in [(0xf98a, [actor]), (0xf9f0, [actor, 0])]:
    e.write(actor, b'\0'*60)
    e.write(actor+2, source)
    call(pc, args)
    actual = e.read(actor+2, 4)
    assert actual == target, (hex(pc), actual.hex(), target.hex())
    rows.append(dict(routine=hex(pc), source=source.hex(), target=actual.hex(), matched=True))
# Existing entry lookup stays functional after relocation.
entry0=e.rom[report['table']:report['table']+8]
e.write(actor,b'\0'*60);e.write(actor+2,entry0[:4]);call(0xf98a,[actor])
assert e.read(actor+2,4)==entry0[4:]
# New map family classifies as new ID 17 across all 12 variants.
for bank in range(3):
    for part in range(4):
        mid=0x500+bank*41+part
        assert call(0x746e,[mid])==17,hex(mid)
# Native lookup of the existing town's exit returns its original world sector.
old_base=int.from_bytes(e.rom[report['bases']:report['bases']+2],'big')
expected=int.from_bytes(entry0[:2],'big')
reg(0,0);value=call(0xf914,[old_base]);assert (e.regs()[0]&65535)==expected
assert state_path.read_bytes()==original_state
print(json.dumps(dict(native_entry_probes=rows,existing_entry_preserved=True,existing_return_preserved=True,new_classifier_variants=12,independent_new_town_playable=False,save_unchanged=True),indent=2))
