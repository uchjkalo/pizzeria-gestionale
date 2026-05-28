@echo off
cd /d %~dp0
del PreparazioneZone.tsx
ren PreparazioneZone_new.tsx PreparazioneZone.tsx
echo File replacement complete
