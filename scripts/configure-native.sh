#!/usr/bin/env bash
# Ajusta os projetos nativos gerados pelo Capacitor (android/ e ios/):
#  - App ID do AdMob (sem ele o app FECHA ao abrir)
#  - orientação retrato
#  - texto do pedido de rastreamento (iOS / ATT)
# Uso: scripts/configure-native.sh android|ios
# Variáveis opcionais: ADMOB_APP_ID_ANDROID, ADMOB_APP_ID_IOS (senão usa os IDs de TESTE do Google)
set -euo pipefail
PLATFORM="${1:?informe android ou ios}"

if [ "$PLATFORM" = "android" ]; then
  APP_ID="${ADMOB_APP_ID_ANDROID:-ca-app-pub-3940256099942544~3347511713}"
  M=android/app/src/main/AndroidManifest.xml
  if ! grep -q "com.google.android.gms.ads.APPLICATION_ID" "$M"; then
    sed -i.bak "s#</application>#    <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"$APP_ID\"/>\n    </application>#" "$M"
  fi
  if ! grep -q 'screenOrientation' "$M"; then
    sed -i.bak 's#<activity#<activity android:screenOrientation="portrait"#' "$M"
  fi
  rm -f "$M.bak"
  echo "Android configurado (AdMob App ID: $APP_ID)"

elif [ "$PLATFORM" = "ios" ]; then
  APP_ID="${ADMOB_APP_ID_IOS:-ca-app-pub-3940256099942544~1458002511}"
  P=ios/App/App/Info.plist
  PB=/usr/libexec/PlistBuddy
  $PB -c "Delete :GADApplicationIdentifier" "$P" 2>/dev/null || true
  $PB -c "Add :GADApplicationIdentifier string $APP_ID" "$P"
  $PB -c "Delete :NSUserTrackingUsageDescription" "$P" 2>/dev/null || true
  $PB -c "Add :NSUserTrackingUsageDescription string Usamos este identificador para mostrar anúncios mais relevantes e manter o jogo gratuito." "$P"
  $PB -c "Delete :UISupportedInterfaceOrientations" "$P" 2>/dev/null || true
  $PB -c "Add :UISupportedInterfaceOrientations array" "$P"
  $PB -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$P"
  # Rede de anúncios do Google (lista completa: developers.google.com/admob/ios/privacy/strategies)
  $PB -c "Delete :SKAdNetworkItems" "$P" 2>/dev/null || true
  $PB -c "Add :SKAdNetworkItems array" "$P"
  $PB -c "Add :SKAdNetworkItems:0 dict" "$P"
  $PB -c "Add :SKAdNetworkItems:0:SKAdNetworkIdentifier string cstr6suwn9.skadnetwork" "$P"
  echo "iOS configurado (AdMob App ID: $APP_ID)"
else
  echo "plataforma inválida: $PLATFORM" >&2; exit 1
fi
