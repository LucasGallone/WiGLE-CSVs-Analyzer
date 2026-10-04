import {
  WigleCsvHeader,
  WigleRawRecord,
  ProcessedAccessPoint,
  ScanSessionData,
  AccessPointObservation,
  SecurityCategory,
  SecurityType,
  WifiBand,
  FileMetadata,
} from '../types/wigle';
import { resolveVendor } from '../data/ouiDatabase';

/**
 * Automatically generates a comprehensive technical analysis description based on WiGLE capability tokens.
 * Returns structured bullet points and complete narrative in both English and French.
 */
export function generateTechnicalAnalysis(
  mode: string,
  type: string,
  cipherLabel: string,
  keyMgmt: string[],
  ciphers: string[]
): {
  en: string;
  fr: string;
  pointsEn: string[];
  pointsFr: string[];
} {
  const upper = (mode || '').toUpperCase();

  const isIbss = upper.includes('IBSS');
  const isEss = upper.includes('ESS') && !isIbss;

  if (type === 'OPEN' || upper === '[ESS]' || upper === '[]' || !upper) {
    const pointsEn = [
      '• **Architecture:** Open, unencrypted network.',
      '• **Encryption:** None (0-bit plaintext transmission)\nNote: [ESS] is an infrastructure topology token, not an encryption cipher.',
      '• **Key Management:** None (Free access without security key).',
      ...(isIbss
        ? ['• **Network Topology:** Independent Basic Service Set (IBSS / Ad-Hoc Peer-to-Peer)\nDecentralized direct wireless connection between client devices without a centralized router or AP.\nPoses distinct attack vectors directly targeting transmitting host devices.']
        : isEss
        ? ['• **Network Topology:** Extended Service Set (ESS / Infrastructure Mode)\nStandard centralized wireless infrastructure where client stations associate to an Access Point.']
        : []),
      '• **Security Assessment:** Critical Risk\nAll transmitted packets, sessions, and credentials travel in cleartext and can be captured passively by any device within physical proximity.',
    ];
    const pointsFr = [
      '• **Architecture :** Point d’accès ouvert sans aucun chiffrement.',
      '• **Chiffrement :** Aucun (Transmission des données en clair, 0-bit)\nNote : [ESS] est un marqueur de topologie réseau et non un chiffrement.',
      '• **Gestion des clés :** Aucune (Accès libre sans clé de sécurité).',
      ...(isIbss
        ? ['• **Topologie réseau :** Independent Basic Service Set (IBSS / Ad-Hoc Point-à-Point)\nRéseau pair-à-pair décentralisé reliant directement des appareils clients sans routeur ni borne d’accès centralisée.\nImplique des vecteurs d’attaque spécifiques ciblant directement les hôtes émetteurs.']
        : isEss
        ? ['• **Topologie réseau :** Extended Service Set (ESS / Mode Infrastructure)\nInfrastructure sans fil centralisée standard où les stations clientes s’associent à un point d’accès.']
        : []),
      '• **Évaluation de sécurité :** Risque critique\nL’ensemble des flux circule en clair et peut être intercepté passivement par n’importe quel équipement à portée.',
    ];
    return {
      en: pointsEn.join('\n\n'),
      fr: pointsFr.join('\n\n'),
      pointsEn,
      pointsFr,
    };
  }

  if (type === 'WEP') {
    const pointsEn = [
      '• **Architecture:** Legacy WEP (Wired Equivalent Privacy) IEEE 802.11b/g protocol.',
      `• **Encryption:** ${cipherLabel || 'WEP (40/104-bit)'} RC4 stream cipher with weak 24-bit Initialization Vectors (IVs).`,
      '• **Key Management:** Static shared key without dynamic per-session re-keying.',
      '• **Security Assessment:** Obsolete & Severely Vulnerable\nWEP keys can be reconstructed cryptanalytically in seconds via statistical IV packet injection attacks (FMS/KoreK/PTW).',
    ];
    const pointsFr = [
      '• **Architecture\u00A0:** Protocole patrimonial WEP (Wired Equivalent Privacy) IEEE 802.11b/g.',
      `• **Chiffrement\u00A0:** Chiffrement par flux RC4 ${cipherLabel || 'WEP (40/104-bit)'} avec vecteur d’initialisation (IV) court de 24 bits.`,
      '• **Gestion des clés\u00A0:** Clé statique partagée sans dérivation dynamique de session.',
      '• **Évaluation de sécurité\u00A0:** Obsolète & Très Vulnérable\nCassable en quelques secondes par injection et écoute passive des vecteurs IV (attaques FMS/PTW).',
    ];
    return {
      en: pointsEn.join('\n\n'),
      fr: pointsFr.join('\n\n'),
      pointsEn,
      pointsFr,
    };
  }

  const pointsEn: string[] = [];
  const pointsFr: string[] = [];

  const hasTkip = upper.includes('TKIP');
  const hasCcmp256 = upper.includes('CCMP-256') || upper.includes('AES-256');
  const hasCcmp128 = upper.includes('CCMP-128') || upper.includes('AES-128') || (upper.includes('CCMP') && !upper.includes('CCMP-256'));
  const hasDualCcmp = hasCcmp256 && (hasCcmp128 || upper.includes('CCMP-256+CCMP-128') || upper.includes('CCMP-128+CCMP-256') || upper.includes('+CCMP-128') || upper.includes('+CCMP-256'));
  const hasCcmp = hasCcmp256 || hasCcmp128 || upper.includes('AES');
  const hasGcmp256 = upper.includes('GCMP-256');
  const hasGcmp128 = upper.includes('GCMP-128') || (upper.includes('GCMP') && !upper.includes('GCMP-256'));
  const hasDualGcmp = hasGcmp256 && (hasGcmp128 || upper.includes('GCMP-256+GCMP-128') || upper.includes('GCMP-128+GCMP-256') || upper.includes('+GCMP-128') || upper.includes('+GCMP-256'));
  const hasGcmp = hasGcmp256 || hasGcmp128;
  const isMixedCipher = hasTkip && (hasCcmp || hasGcmp);

  const isWpa1Eap = upper.includes('WPA-EAP') || upper.includes('[WPA-EAP') || (upper.includes('WPA-') && upper.includes('EAP'));
  const isWpa2Eap = upper.includes('WPA2-EAP') || upper.includes('RSN-EAP') || upper.includes('[WPA2-EAP') || upper.includes('[RSN-EAP') || (upper.includes('RSN') && upper.includes('EAP')) || (upper.includes('WPA2') && upper.includes('EAP'));
  const isEnterpriseMixed = isWpa1Eap && isWpa2Eap;

  const hasPskSha256InUpper = upper.includes('PSK-SHA256') || upper.includes('PSK_SHA256');
  const hasStandardPskInUpper =
    (upper.includes('-PSK') || upper.includes('+PSK') || upper.includes('PSK+') || upper.includes('/PSK') || upper.includes('WPA-PSK') || upper.includes('WPA2-PSK') || upper.includes('RSN-PSK')) &&
    (!hasPskSha256InUpper || upper.includes('PSK+') || upper.includes('+PSK') || upper.includes('PSK-SHA256+PSK') || upper.includes('PSK+PSK-SHA256'));
  const hasDualPskAkms = hasPskSha256InUpper && hasStandardPskInUpper;

  const isOwe = upper.includes('OWE');
  const hasSae = upper.includes('SAE');
  const hasDpp = upper.includes('DPP');
  const hasFils = upper.includes('FILS');
  const hasOsen = upper.includes('OSEN');
  const isTransitionMode = type === 'WPA2_WPA3' || (hasSae && (hasStandardPskInUpper || hasPskSha256InUpper || upper.includes('PSK')));

  // 1. Core Architecture & Protocol
  if (isOwe) {
    if (upper.includes('OWE_TRANSITION') || upper.includes('OWE-TRANSITION') || upper.includes('OWE/TRANSITION')) {
      pointsEn.push('• **Architecture:** Opportunistic Wireless Encryption Transition Mode (OWE Transition / WPA3 Enhanced Open)\nDual-stack configuration allowing legacy unencrypted open connections while providing compatible devices with Diffie-Hellman session encryption.');
      pointsFr.push('• **Architecture\u00A0:** Mode de transition OWE (OWE Transition / WPA3 Enhanced Open)\nConfiguration hybride permettant la connexion ouverte en clair des clients anciens tout en négociant une session chiffrée Diffie-Hellman pour les clients compatibles.');
    } else {
      pointsEn.push('• **Architecture:** Opportunistic Wireless Encryption (OWE / WPA3 Enhanced Open / RFC 8110)\nProvides individualized Diffie-Hellman session encryption for open hotspots without a preshared key.');
      pointsFr.push('• **Architecture\u00A0:** Opportunistic Wireless Encryption (OWE / WPA3 Enhanced Open / RFC 8110)\nFournit un chiffrement de session individualisé par échange Diffie-Hellman pour bornes ouvertes sans mot de passe partagé.');
    }
  } else if (type === 'WPA3_ENTERPRISE' || (type === 'ENTERPRISE' && (upper.includes('WPA3') || upper.includes('SUITE')))) {
    if (upper.includes('SUITE_B') || upper.includes('SUITE-B') || upper.includes('SUITEB')) {
      pointsEn.push('• **Architecture:** WPA3-Enterprise 192-Bit Security Mode (NSA CNSA / Suite B)\nMission-critical 192-bit enterprise security mode conforming to strict government, military, and financial security requirements.\nMandates 256-bit Galois/Counter Mode Protocol (GCMP-256) and Protected Management Frames (MFPR).');
      pointsFr.push('• **Architecture\u00A0:** WPA3-Enterprise Haute Sécurité 192-Bit (Suite B / NSA CNSA)\n Mode d’entreprise très haute sécurité 192-bit conforme aux normes gouvernementales, militaires et financières les plus strictes.\nImpose le chiffrement GCMP-256 (256-bit) et la protection obligatoire des trames de gestion (MFPR).');
    } else {
      pointsEn.push('• **Architecture:** WPA3-Enterprise (IEEE 802.1X / EAP)\nModern enterprise network infrastructure providing per-user dynamic credentials via RADIUS and mandatory Management Frame Protection (802.11w).');
      pointsFr.push('• **Architecture\u00A0:** WPA3-Enterprise (IEEE 802.1X / EAP)\nInfrastructure réseau d’entreprise moderne assurant une authentification individuelle par serveur RADIUS et la protection obligatoire des trames de gestion (802.11w).');
    }
  } else if (type === 'WPA3') {
    if (upper.includes('SUITE_B') || upper.includes('SUITE-B') || upper.includes('SUITEB')) {
      pointsEn.push('• **Architecture:** WPA3-Enterprise 192-Bit Security Mode (NSA CNSA / Suite B)\nMission-critical configuration conforming to strict government and enterprise compliance.');
      pointsFr.push('• **Architecture\u00A0:** WPA3-Enterprise Haute Sécurité 192-Bit (Suite B / NSA CNSA)\nConfiguration hautement sensible conforme aux exigences gouvernementales et industrielles strictes.');
    } else {
      pointsEn.push('• **Architecture:** WPA3-Personal (Pure)\nStrict WPA3-SAE configuration requiring mandatory PMF (MFPR). Legacy WPA2-PSK clients are not supported.');
      pointsFr.push('• **Architecture\u00A0:** WPA3-Personal (Pur)\nConfiguration WPA3-SAE stricte imposant le PMF obligatoire (MFPR). Les clients WPA2-PSK hérités ne sont pas pris en charge.');
    }
  } else if (isTransitionMode) {
    pointsEn.push('• **Architecture:** WPA2 / WPA3 Hybrid Transition Mode\nDual-stack configuration serving modern WPA3-SAE clients while maintaining backward support for legacy WPA2-PSK devices.');
    pointsFr.push('• **Architecture\u00A0:** Mode Hybride WPA2 / WPA3 (Transition)\nConfiguration à double pile assurant la négociation WPA3-SAE moderne tout en préservant la compatibilité WPA2-PSK.');
  } else if (hasOsen) {
    pointsEn.push('• **Architecture:** Passpoint / Hotspot 2.0 OSEN\nOnline Signup and Secure Provisioning Architecture for Carrier Wi-Fi Offloading.');
    pointsFr.push('• **Architecture\u00A0:** Passpoint / Hotspot 2.0 OSEN\nArchitecture d’enrôlement et de provisionnement sécurisé pour le délestage cellulaire Wi-Fi.');
  } else if (type === 'WPA1_ENTERPRISE') {
    pointsEn.push('• **Architecture:** Legacy WPA1-Enterprise (IEEE 802.1X / EAP)\nFirst-generation enterprise RADIUS authentication framework, deprecated by the Wi-Fi Alliance.');
    pointsFr.push('• **Architecture\u00A0:** WPA1-Entreprise Hérité (IEEE 802.1X / EAP)\nPremière génération d’authentification d’entreprise via RADIUS, officiellement dépréciée par la Wi-Fi Alliance.');
  } else if (type === 'ENTERPRISE') {
    if (isEnterpriseMixed) {
      pointsEn.push('• **Architecture:** Enterprise IEEE 802.1X / EAP (WPA1 / WPA2 Mixed Mode)\nCentralized RADIUS authentication supporting both legacy WPA1 and standard WPA2 enterprise clients.');
      pointsFr.push('• **Architecture\u00A0:** Infrastructure Entreprise IEEE 802.1X / EAP (Mode Mixte WPA1 / WPA2)\nAuthentification centralisée via serveur RADIUS supportant les clients WPA1 hérités et WPA2 standard.');
    } else {
      pointsEn.push('• **Architecture:** Enterprise IEEE 802.1X / EAP Infrastructure\nCentralized RADIUS authentication requiring unique per-user credentials, certificates, or SIM credentials.');
      pointsFr.push('• **Architecture\u00A0:** Infrastructure Entreprise IEEE 802.1X / EAP\nAuthentification centralisée via serveur RADIUS avec identifiants, certificats ou profils individuels.');
    }
  } else if (type === 'WPA_WPA2') {
    if (hasTkip && hasCcmp) {
      pointsEn.push('• **Architecture:** WPA1 / WPA2 Mixed Mode (CCMP + TKIP)\nBackward-compatible transitional configuration bridging legacy WPA1 (TKIP) and standard WPA2 (AES-CCMP).');
      pointsFr.push('• **Architecture\u00A0:** Mode Mixte WPA1 / WPA2 (CCMP + TKIP)\nConfiguration transitoire combinant l’ancien WPA1 (TKIP) et le standard WPA2 (AES-CCMP).');
    } else if (!hasTkip && (hasCcmp || hasGcmp)) {
      pointsEn.push('• **Architecture:** WPA1 / WPA2 Mixed Mode (Pure AES-CCMP)\nBackward-compatible configuration enabling WPA1 clients while enforcing robust AES-CCMP encryption across both protocol generations (TKIP is not enabled).');
      pointsFr.push('• **Architecture\u00A0:** Mode Mixte WPA1 / WPA2 (AES-CCMP Pur)\nConfiguration acceptant les clients WPA1 tout en imposant le chiffrement robuste AES-CCMP sur les deux générations (TKIP n’est pas activé).');
    } else if (hasTkip && !hasCcmp) {
      pointsEn.push('• **Architecture:** WPA1 / WPA2 Mixed Mode (TKIP only)\nLegacy configuration restricted to TKIP stream cipher.');
      pointsFr.push('• **Architecture\u00A0:** Mode Mixte WPA1 / WPA2 (TKIP seul)\nConfiguration héritée restreinte au chiffrement par flux TKIP.');
    } else {
      pointsEn.push('• **Architecture:** WPA1 / WPA2 Mixed Mode\nDual-generation configuration bridging WPA1 and WPA2 client devices.');
      pointsFr.push('• **Architecture\u00A0:** Mode Mixte WPA1 / WPA2\nConfiguration intergénérationnelle supportant les clients WPA1 et WPA2.');
    }
  } else if (type === 'WPA') {
    if (!hasTkip && (hasCcmp || hasGcmp)) {
      pointsEn.push('• **Architecture:** Legacy WPA1 (Wi-Fi Protected Access v1 with AES-CCMP)\nFirst-generation standard using optional AES-CCMP encryption.');
      pointsFr.push('• **Architecture\u00A0:** WPA1 Hérité (Wi-Fi Protected Access v1 avec AES-CCMP)\nPremière génération utilisant le chiffrement optionnel AES-CCMP.');
    } else {
      pointsEn.push('• **Architecture:** Legacy WPA1 (Wi-Fi Protected Access v1 with TKIP)\nFirst-generation interim standard based on TKIP/RC4, officially deprecated by the Wi-Fi Alliance.');
      pointsFr.push('• **Architecture\u00A0:** WPA1 Hérité (Wi-Fi Protected Access v1 avec TKIP)\nPremière génération basée sur TKIP/RC4, officiellement dépréciée par la Wi-Fi Alliance.');
    }
  } else {
    if (hasDualPskAkms) {
      pointsEn.push('• **Architecture:** Standard WPA2-PSK with Dual AKM Suite (IEEE 802.11i / RSN)\nPre-shared key configuration supporting both standard PSK (AKM 2 / SHA-1) and reinforced PSK-SHA256 (AKM 6).');
      pointsFr.push('• **Architecture\u00A0:** Standard WPA2-PSK avec double suite AKM (IEEE 802.11i / RSN)\nConfiguration à clé pré-partagée supportant le PSK standard (AKM 2 / SHA-1) et le PSK-SHA256 renforcé (AKM 6).');
    } else if (hasPskSha256InUpper) {
      pointsEn.push('• **Architecture:** Standard WPA2-PSK with Reinforced PSK-SHA256 (IEEE 802.11i / RSN)\nPre-shared key configuration enforcing SHA-256 key derivation (AKM 6).');
      pointsFr.push('• **Architecture\u00A0:** Standard WPA2-PSK avec dérivation renforcée PSK-SHA256 (IEEE 802.11i / RSN)\nConfiguration imposant la dérivation SHA-256 (AKM 6).');
    } else {
      pointsEn.push('• **Architecture:** Standard WPA2-PSK (IEEE 802.11i / RSN)\nWidely deployed personal pre-shared key standard.');
      pointsFr.push('• **Architecture\u00A0:** Standard WPA2-PSK (IEEE 802.11i / RSN)\nStandard domestique et bureautique à clé pré-partagée le plus répandu.');
    }
  }

  // 2. Symmetric Ciphers & Bit Lengths
  const cipherBitsEn: string[] = [];
  const cipherBitsFr: string[] = [];
  
  if (hasDualGcmp) {
    cipherBitsEn.push('Galois/Counter Mode Protocol (128-bit & 256-bit GCMP, ultra-fast hardware crypto for Wi-Fi 6/6E/7)');
    cipherBitsFr.push('Galois/Counter Mode Protocol (GCMP 128 et 256 bits, très haut débit matériel Wi-Fi 6/6E/7)');
  } else if (hasGcmp256) {
    cipherBitsEn.push('Galois/Counter Mode Protocol 256-bit (GCMP-256, ultra-fast hardware crypto for Wi-Fi 6/6E/7)');
    cipherBitsFr.push('Galois/Counter Mode Protocol 256 bits (GCMP-256, très haut débit matériel Wi-Fi 6/6E/7)');
  } else if (hasGcmp128) {
    cipherBitsEn.push('Galois/Counter Mode Protocol 128-bit (GCMP-128)');
    cipherBitsFr.push('Galois/Counter Mode Protocol 128 bits (GCMP-128)');
  }

  if (hasDualCcmp) {
    cipherBitsEn.push('AES-CCMP 128-bit & 256-bit (Supports standard 128-bit and reinforced 256-bit Counter Mode with CBC-MAC)');
    cipherBitsFr.push('AES-CCMP 128 bits et 256 bits (Supporte le standard 128 bits et le mode renforcé 256 bits avec CBC-MAC)');
  } else if (hasCcmp256) {
    cipherBitsEn.push('AES-CCMP 256-bit (Reinforced Counter Mode with CBC-MAC)');
    cipherBitsFr.push('AES-CCMP 256 bits (Chiffrement symétrique renforcé avec CBC-MAC)');
  } else if (hasCcmp128) {
    cipherBitsEn.push('AES-CCMP 128-bit (Standard Counter Mode with CBC-MAC, robust baseline encryption)');
    cipherBitsFr.push('AES-CCMP 128 bits (Norme standard robuste Counter Mode avec CBC-MAC)');
  }

  if (hasTkip) {
    cipherBitsEn.push('Temporal Key Integrity Protocol (TKIP 128-bit RC4 wrapper, limited to 54 Mbps max)');
    cipherBitsFr.push('Temporal Key Integrity Protocol (TKIP 128 bits basé sur RC4, bridé à 54 Mbps max)');
  }

  if (cipherBitsEn.length > 0) {
    pointsEn.push(`• **Symmetric Ciphers:** ${cipherBitsEn.join(' + ')}.`);
    pointsFr.push(`• **Chiffrement symétrique\u00A0:** ${cipherBitsFr.join(' + ')}.`);
  }

  // 3. Key Management & AKMs
  const akmEn: string[] = [];
  const akmFr: string[] = [];
  if (upper.includes('SAE_EXT_KEY')) {
    akmEn.push('SAE Extended Key Derivation (AKM 24, enforces longer session keys for 256-bit ciphers)');
    akmFr.push('Dérivation de clé étendue SAE_EXT_KEY (AKM 24, clé de session allongée pour ciphers 256-bit)');
  }
  if (upper.includes('SAE')) {
    akmEn.push('SAE (AKM 8, Dragonfly zero-knowledge proof)');
    akmFr.push('SAE (AKM 8, algorithme Dragonfly à preuve nulle de connaissance)');
  }
  if (hasPskSha256InUpper) {
    akmEn.push('PSK-SHA256 (AKM 6, SHA-256 key derivation replacing legacy HMAC-SHA1)');
    akmFr.push('PSK-SHA256 (AKM 6, dérivation renforcée SHA-256 remplaçant HMAC-SHA1)');
  }
  if (hasStandardPskInUpper) {
    akmEn.push('PSK (AKM 2, HMAC-SHA1 4-way handshake)');
    akmFr.push('PSK (AKM 2, 4-way handshake basé sur HMAC-SHA1)');
  }
  if (upper.includes('SUITE_B_192') || upper.includes('SUITE-B-192') || upper.includes('SUITEB_192') || upper.includes('SUITE_B') || upper.includes('SUITE-B') || upper.includes('SUITEB')) {
    akmEn.push('EAP-SUITE-B-192 (AKM 12, 192-bit NSA CNSA Suite B with ECDSA P-384 / SHA-384)');
    akmFr.push('EAP-SUITE-B-192 (AKM 12, Suite B 192-bit NSA CNSA avec ECDSA P-384 / SHA-384)');
  } else if (upper.includes('EAP/SHA256') || upper.includes('EAP-SHA256')) {
    akmEn.push('EAP-SHA256 (Enterprise 802.1X with SHA-256 derivation)');
    akmFr.push('EAP-SHA256 (Entreprise 802.1X avec dérivation SHA-256)');
  }
  if (
    (upper.includes('EAP') || upper.includes('802.1X') || upper.includes('8021X')) &&
    !upper.includes('SUITE_B') &&
    !upper.includes('SUITE-B') &&
    !upper.includes('SUITEB') &&
    (!upper.includes('EAP/SHA256') || upper.includes('+EAP') || upper.includes('EAP+') || upper.includes('EAP/SHA1'))
  ) {
    akmEn.push('EAP (Enterprise 802.1X authentication)');
    akmFr.push('EAP (Authentification centralisée 802.1X)');
  }
  if (upper.includes('OWE')) {
    akmEn.push('OWE (AKM 18, Diffie-Hellman Group 19 key agreement)');
    akmFr.push('OWE (AKM 18, négociation Diffie-Hellman Groupe 19)');
  }
  if (upper.includes('FILS-SHA384')) {
    akmEn.push('FILS-SHA384 (AKM 30, Fast Initial Link Setup with SHA-384)');
    akmFr.push('FILS-SHA384 (AKM 30, Fast Initial Link Setup avec dérivation SHA-384)');
  } else if (upper.includes('FILS-SHA256')) {
    akmEn.push('FILS-SHA256 (AKM 29, Fast Initial Link Setup with SHA-256)');
    akmFr.push('FILS-SHA256 (AKM 29, Fast Initial Link Setup avec dérivation SHA-256)');
  } else if (upper.includes('FILS')) {
    akmEn.push('Fast Initial Link Setup (IEEE 802.11ai FILS connection)');
    akmFr.push('Fast Initial Link Setup (Connexion accélérée IEEE 802.11ai FILS)');
  }
  if (hasDpp) {
    akmEn.push('DPP (Device Provisioning Protocol / Wi-Fi Easy Connect)');
    akmFr.push('DPP (Device Provisioning Protocol / Wi-Fi Easy Connect)');
  }
  if (hasOsen) {
    akmEn.push('OSEN (Passpoint Online Signup)');
    akmFr.push('OSEN (Passpoint Enrôlement en ligne)');
  }

  if (akmEn.length > 0) {
    pointsEn.push(`• **Key Management (AKM):** ${akmEn.join(' + ')}.`);
    pointsFr.push(`• **Gestion des clés (AKM)\u00A0:** ${akmFr.join(' + ')}.`);
  }

  // 4. Protected Management Frames (PMF / 802.11w)
  if (upper.includes('MFPR')) {
    pointsEn.push('• **Frame Protection (802.11w PMF):** REQUIRED (MFPR)\nManagement Frame Protection is mandatory. Clients without PMF support are refused connection. Fully protects against deauthentication and disassociation spoofing attacks.');
    pointsFr.push('• **Protection des trames (802.11w PMF)\u00A0:** OBLIGATOIRE (MFPR)\nChiffrement des trames de gestion requis. Les clients non compatibles sont rejetés. Immunise totalement contre les attaques de désauthentification par spoofing.');
  } else if (upper.includes('MFPC')) {
    pointsEn.push('• **Frame Protection (802.11w PMF):** CAPABLE (MFPC)\nManagement Frame Protection is supported optionally for compatible client devices.');
    pointsFr.push('• **Protection des trames (802.11w PMF)\u00A0:** SUPPORTÉE (MFPC)\nProtection des trames de gestion active en option pour les équipements clients compatibles.');
  } else {
    pointsEn.push('• **Frame Protection (802.11w PMF):** NONE\nManagement frames are transmitted unencrypted; clients remain vulnerable to spoofed deauthentication DoS attacks.');
    pointsFr.push('• **Protection des trames (802.11w PMF)\u00A0:** ABSENTE\nLes trames de gestion circulent en clair ; les clients restent vulnérables aux attaques DoS par désauthentification.');
  }

  // 5. Mobility / Fast Roaming (802.11r) & Modern Link Setup (FILS / DPP)
  if (upper.includes('FT/PSK') || upper.includes('FT/EAP') || upper.includes('FT+') || upper.includes('FT-') || upper.includes('FT/SAE')) {
    pointsEn.push('• **Roaming & Mobility:** Fast BSS Transition (IEEE 802.11r FT) Active\nCaches master keys to permit instant sub-50ms handoffs between access points without full re-authentication (ideal for VoIP and low-latency mesh networks).');
    pointsFr.push('• **Mobilité & Roaming\u00A0:** Fast BSS Transition (IEEE 802.11r FT) Activé\nPréserve les clés maîtresses pour basculer instantanément (<50\u00A0ms) d’une borne à l’autre sans coupure (idéal VoIP et réseaux Mesh).');
  }

  if (hasFils) {
    pointsEn.push('• **Roaming & Initial Link:** Fast Initial Link Setup (IEEE 802.11ai FILS)\nOptimizes AP association and authentication to achieve sub-100ms ultra-fast connection times.');
    pointsFr.push('• **Itinérance & Connexion\u00A0:** Fast Initial Link Setup (IEEE 802.11ai FILS)\nOptimise l’association et l’authentification pour atteindre des temps de connexion ultra-rapides inférieurs à 100\u00A0ms.');
  }

  if (hasDpp) {
    pointsEn.push('• **Provisioning:** Device Provisioning Protocol (DPP / Wi-Fi Easy Connect)\nModern, cryptographically secure public-key enrollment protocol replacing legacy WPS (QR code / NFC enrollment).');
    pointsFr.push('• **Provisionnement\u00A0:** Device Provisioning Protocol (DPP / Wi-Fi Easy Connect)\nProtocole d’enrôlement moderne à clé publique remplaçant le WPS de manière hautement sécurisée (enrôlement par QR code / NFC).');
  }

  // 6. Network Topology (ESS vs IBSS)
  if (isIbss) {
    pointsEn.push('• **Network Topology:** Independent Basic Service Set (IBSS / Ad-Hoc Peer-to-Peer)\nDecentralized direct wireless connection between client devices without a centralized router or AP. Poses distinct attack vectors directly targeting transmitting host devices (smartphones/laptops).');
    pointsFr.push('• **Topologie réseau\u00A0:** Independent Basic Service Set (IBSS / Ad-Hoc Point-à-Point)\nRéseau pair-à-pair décentralisé reliant directement des appareils clients sans routeur ni borne d’accès centralisée. Implique des vecteurs d’attaque spécifiques ciblant directement les hôtes émetteurs (smartphones/ordinateurs).');
  } else if (isEss) {
    pointsEn.push('• **Network Topology:** Extended Service Set (ESS / Infrastructure Mode)\nStandard centralized wireless infrastructure where client stations associate to an Access Point.');
    pointsFr.push('• **Topologie réseau\u00A0:** Extended Service Set (ESS / Mode Infrastructure)\nInfrastructure sans fil centralisée standard où les stations clientes s’associent à un point d’accès.');
  }

  // 7. WPS (Information & Risk Awareness)
  const hasWpsToken = upper.includes('WPS');
  if (hasWpsToken) {
    pointsEn.push('• **Wi-Fi Protected Setup (WPS):** Pairing Feature Active\n\nEnables simplified client device onboarding (via physical push-button PBC or PIN). While convenient, keeping WPS active can increase the network attack surface if PIN-based enrollment lacks rate-limiting or lockout protections (potential exposure to brute-force or Pixie Dust methods on older equipment).\n\nPhysical push-button (PBC) pairing remains the safer approach.');
    pointsFr.push('• **Wi-Fi Protected Setup (WPS)\u00A0:** Protocole d’association actif\n\nFacilite l’appairage rapide des équipements clients (via bouton physique PBC ou code PIN). Bien que pratique au quotidien, son activation peut élargir la surface d’exposition du réseau en cas d’implémentation vulnérable du mode PIN (sensibilité potentielle aux tentatives de force brute ou attaques de type Pixie Dust sur certains matériels anciens ou dépourvus de verrouillage temporaire).\n\nLe mode bouton-poussoir (PBC) reste généralement privilégié.');
  }

  return {
    en: pointsEn.join('\n\n'),
    fr: pointsFr.join('\n\n'),
    pointsEn,
    pointsFr,
  };
}

/**
 * Classifies security mode into clean category with detailed cipher & key management metadata
 */
export function classifySecurity(authMode: string): SecurityCategory {
  const mode = (authMode || '').trim().toUpperCase();
  const hasWps = mode.includes('[WPS]') || mode.includes('WPS');

  // Check if capability string contains any known cryptographic cipher or protocol
  const hasEncryptionKeyword =
    mode.includes('WEP') ||
    mode.includes('WPA') ||
    mode.includes('RSN') ||
    mode.includes('SAE') ||
    mode.includes('EAP') ||
    mode.includes('802.1X') ||
    mode.includes('8021X') ||
    mode.includes('CCMP') ||
    mode.includes('TKIP') ||
    mode.includes('GCMP') ||
    mode.includes('PSK') ||
    mode.includes('OWE') ||
    mode.includes('SUITE-B') ||
    mode.includes('SUITE_B') ||
    mode.includes('SUITEB') ||
    mode.includes('WAPI') ||
    mode.includes('DPP') ||
    mode.includes('FILS') ||
    mode.includes('OSEN');

  // Parse Ciphers with exact bit-length precision
  const ciphers: string[] = [];
  const cipherShorts: string[] = [];

  const hasCcmp256 = mode.includes('CCMP-256') || mode.includes('AES-256');
  const hasCcmp128 = mode.includes('CCMP-128') || mode.includes('AES-128') || (mode.includes('CCMP') && !mode.includes('CCMP-256'));
  const hasDualCcmp = hasCcmp256 && (hasCcmp128 || mode.includes('CCMP-256+CCMP-128') || mode.includes('CCMP-128+CCMP-256') || mode.includes('+CCMP-128') || mode.includes('+CCMP-256'));

  const hasGcmp256 = mode.includes('GCMP-256');
  const hasGcmp128 = mode.includes('GCMP-128') || (mode.includes('GCMP') && !mode.includes('GCMP-256'));
  const hasDualGcmp = hasGcmp256 && (hasGcmp128 || mode.includes('GCMP-256+GCMP-128') || mode.includes('GCMP-128+GCMP-256') || mode.includes('+GCMP-128') || mode.includes('+GCMP-256'));

  const hasTkip = mode.includes('TKIP');
  const hasWep40 = mode.includes('WEP40') || mode.includes('WEP-40');
  const hasWep104 = mode.includes('WEP104') || mode.includes('WEP-104') || mode.includes('WEP128');
  const hasWep = mode.includes('WEP');

  if (hasDualGcmp) {
    ciphers.push('GCMP (128-bit & 256-bit)');
    cipherShorts.push('GCMP (128-bit & 256-bit)');
  } else if (hasGcmp256) {
    ciphers.push('GCMP (256-bit)');
    cipherShorts.push('GCMP (256-bit)');
  } else if (hasGcmp128) {
    ciphers.push('GCMP (128-bit)');
    cipherShorts.push('GCMP (128-bit)');
  }

  if (hasDualCcmp) {
    ciphers.push('AES-CCMP (128-bit & 256-bit)');
    cipherShorts.push('AES-CCMP (128-bit & 256-bit)');
  } else if (hasCcmp256) {
    ciphers.push('AES-CCMP (256-bit)');
    cipherShorts.push('AES-CCMP (256-bit)');
  } else if (hasCcmp128) {
    ciphers.push('AES-CCMP (128-bit)');
    cipherShorts.push('AES-CCMP (128-bit)');
  }

  if (hasTkip) {
    ciphers.push('TKIP (128-bit)');
    cipherShorts.push('TKIP (128-bit)');
  }

  if (hasWep104) {
    ciphers.push('WEP (104-bit)');
    cipherShorts.push('WEP-104');
  } else if (hasWep40) {
    ciphers.push('WEP (40-bit)');
    cipherShorts.push('WEP-40');
  } else if (hasWep && ciphers.length === 0) {
    ciphers.push('WEP (104-bit)');
    cipherShorts.push('WEP');
  }

  // Parse Key Management & Authentication (accurately capturing multiple AKMs)
  const keyMgmt: string[] = [];
  if (mode.includes('SAE_EXT_KEY')) keyMgmt.push('SAE_EXT_KEY (AKM 24)');
  if (mode.includes('SAE')) keyMgmt.push('SAE (AKM 8)');

  const hasPskSha256 = mode.includes('PSK-SHA256') || mode.includes('PSK_SHA256');
  const hasStandardPsk =
    (mode.includes('-PSK') || mode.includes('+PSK') || mode.includes('PSK+') || mode.includes('/PSK') || mode.includes('WPA-PSK') || mode.includes('WPA2-PSK') || mode.includes('RSN-PSK')) &&
    (!hasPskSha256 || mode.includes('PSK+') || mode.includes('+PSK') || mode.includes('PSK-SHA256+PSK') || mode.includes('PSK+PSK-SHA256'));

  if (hasStandardPsk) keyMgmt.push('PSK (AKM 2)');
  if (hasPskSha256) keyMgmt.push('PSK-SHA256 (AKM 6)');

  if (mode.includes('EAP/SHA256') || mode.includes('EAP-SHA256')) keyMgmt.push('EAP-SHA256');
  if (
    (mode.includes('EAP') || mode.includes('802.1X') || mode.includes('8021X')) &&
    (!mode.includes('EAP/SHA256') || mode.includes('+EAP') || mode.includes('EAP+') || mode.includes('EAP/SHA1'))
  ) {
    keyMgmt.push('EAP (802.1X)');
  }
  if (mode.includes('OWE')) keyMgmt.push('OWE (AKM 18)');
  if (mode.includes('SUITE_B') || mode.includes('SUITE-B') || mode.includes('SUITEB')) keyMgmt.push('Suite B (192-bit)');
  if (mode.includes('FT/PSK') || mode.includes('FT-PSK')) keyMgmt.push('FT/PSK (802.11r)');
  if (mode.includes('FT/SAE')) keyMgmt.push('FT/SAE (802.11r)');
  if (mode.includes('FT/EAP') || mode.includes('FT-EAP')) keyMgmt.push('FT/EAP (802.11r)');
  if (mode.includes('FILS-SHA384')) keyMgmt.push('FILS-SHA384');
  else if (mode.includes('FILS-SHA256')) keyMgmt.push('FILS-SHA256');
  else if (mode.includes('FILS')) keyMgmt.push('FILS (802.11ai)');
  if (mode.includes('DPP')) keyMgmt.push('DPP (Easy Connect)');
  if (mode.includes('OSEN')) keyMgmt.push('OSEN (Passpoint)');

  // Parse Protocols
  const protocols: string[] = [];
  if (mode.includes('WPA3')) protocols.push('WPA3');
  if (mode.includes('WPA2')) protocols.push('WPA2');
  if (mode.includes('RSN')) protocols.push('RSN');
  if (mode.includes('WPA-') || mode.includes('[WPA]') || mode.includes('[WPA-') || mode.includes('WPA1')) protocols.push('WPA');
  if (hasWep) protocols.push('WEP');
  if (mode.includes('OWE')) protocols.push('OWE');
  if (mode.includes('OSEN')) protocols.push('OSEN');
  if (mode.includes('DPP')) protocols.push('DPP');
  if (mode.includes('FILS')) protocols.push('FILS');
  if (mode.includes('WAPI')) protocols.push('WAPI');

  // Composite cipher label (e.g. "AES-CCMP (128-bit & 256-bit)", "AES-CCMP (128-bit) + TKIP (128-bit)")
  let cipherLabel = '';
  if (cipherShorts.length > 0) {
    cipherLabel = cipherShorts.join(' + ');
  }

  // PMF & Roaming Flags
  const pmfStatus: 'REQUIRED' | 'CAPABLE' | 'NONE' = mode.includes('MFPR')
    ? 'REQUIRED'
    : mode.includes('MFPC')
    ? 'CAPABLE'
    : 'NONE';

  const fastRoaming =
    mode.includes('FT/PSK') ||
    mode.includes('FT-PSK') ||
    mode.includes('FT/EAP') ||
    mode.includes('FT-EAP') ||
    mode.includes('FT+') ||
    mode.includes('FILS');

  // [] as well as [ESS] or absence of cipher means Open network
  if (
    !mode ||
    mode === '[]' ||
    mode === '[ESS]' ||
    mode === 'NONE' ||
    mode === 'OPEN' ||
    !hasEncryptionKeyword
  ) {
    const analysis = generateTechnicalAnalysis(mode, 'OPEN', 'None', ['None'], ['None']);
    return {
      type: 'OPEN',
      label: 'Open / Unencrypted',
      color: '#ef4444', // Red
      isSecure: false,
      ciphers: ['None'],
      cipherLabel: 'None',
      keyManagement: ['None'],
      protocols: ['Open'],
      details: 'Open Network (Unencrypted)',
      pmfStatus: 'NONE',
      fastRoaming: false,
      securityRating: 'INSECURE',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // WEP (Insecure legacy WEP)
  if (hasWep && !mode.includes('WPA') && !mode.includes('RSN') && !mode.includes('SAE') && !mode.includes('EAP') && !mode.includes('OWE')) {
    const analysis = generateTechnicalAnalysis(mode, 'WEP', cipherLabel || 'WEP (104-bit)', keyMgmt, ciphers);
    return {
      type: 'WEP',
      label: 'WEP',
      color: '#f97316', // Orange
      isSecure: false,
      ciphers: ciphers.length > 0 ? ciphers : ['WEP (104-bit)'],
      cipherLabel: cipherLabel || 'WEP (104-bit)',
      keyManagement: keyMgmt,
      protocols: ['WEP'],
      details: `WEP (${cipherLabel || '104-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: 'INSECURE',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Enterprise (EAP / 802.1X / Suite B)
  const isEnterprise =
    mode.includes('EAP') ||
    mode.includes('802.1X') ||
    mode.includes('8021X') ||
    mode.includes('ENTERPRISE') ||
    mode.includes('SUITE_B') ||
    mode.includes('SUITE-B') ||
    mode.includes('SUITEB');

  if (isEnterprise) {
    const isWpa1Eap = mode.includes('WPA-EAP') || mode.includes('[WPA-EAP') || (mode.includes('WPA-') && mode.includes('EAP'));
    const isWpa2Eap = mode.includes('WPA2-EAP') || mode.includes('RSN-EAP') || mode.includes('[WPA2-EAP') || mode.includes('[RSN-EAP') || (mode.includes('RSN') && mode.includes('EAP')) || (mode.includes('WPA2') && mode.includes('EAP'));
    const isWpa3Ent = mode.includes('WPA3') || mode.includes('SUITE');

    let entType: SecurityType = 'ENTERPRISE';
    let entLabel = 'WPA2 Enterprise';
    let entColor = '#06b6d4'; // Cyan

    if (isWpa3Ent) {
      entType = 'WPA3_ENTERPRISE';
      entLabel = 'WPA3 Enterprise';
      entColor = '#6366f1'; // Indigo
    } else if (isWpa1Eap && !isWpa2Eap) {
      entType = 'WPA1_ENTERPRISE';
      entLabel = 'WPA1 Enterprise';
      entColor = '#0284c7';
    } else if (isWpa1Eap && isWpa2Eap) {
      entType = 'WPA1_ENTERPRISE';
      entLabel = 'WPA1 / WPA2 Enterprise (Mixed)';
      entColor = '#0284c7';
    }

    const analysis = generateTechnicalAnalysis(mode, entType, cipherLabel || 'AES-CCMP (128-bit)', keyMgmt, ciphers);
    return {
      type: entType,
      label: entLabel,
      color: entColor,
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'AES-CCMP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: `${entLabel} (${cipherLabel || 'AES-CCMP 128-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: isWpa3Ent ? 'MAXIMUM' : hasTkip ? 'WEAK' : 'HIGH',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // OWE (Opportunistic Wireless Encryption / Enhanced Open)
  const isOwe = mode.includes('OWE');
  if (isOwe) {
    const isOweTransition =
      mode.includes('OWE-TRANS') ||
      mode.includes('OWE_TRANS') ||
      mode.includes('OWE-TRANSITION') ||
      mode.includes('OWE_TRANSITION') ||
      (mode.includes('OWE') && (mode.includes('TRANSITION') || mode.includes('TRANS')));

    const oweLabel = isOweTransition
      ? 'OWE Transition (WPA3 Enhanced Open)'
      : 'OWE (WPA3 Enhanced Open)';

    const analysis = generateTechnicalAnalysis(mode, 'OPEN', cipherLabel || 'AES-CCMP (128-bit)', keyMgmt, ciphers);
    return {
      type: 'OPEN',
      label: oweLabel,
      color: '#ef4444', // Red / Open category
      isSecure: false,
      ciphers,
      cipherLabel: cipherLabel || 'AES-CCMP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: `${oweLabel} (Unauthenticated)`,
      pmfStatus,
      fastRoaming,
      securityRating: 'WEAK', // Low rating Grade C/D because unauthenticated / MitM vulnerable
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Check for WPA3 / SAE presence
  const hasSae = mode.includes('SAE');
  const hasPsk = mode.includes('PSK') || hasStandardPsk || hasPskSha256;
  const hasSuiteB = mode.includes('SUITE-B') || mode.includes('SUITE_B') || mode.includes('SUITEB');

  // Transition Mode (WPA2_WPA3): STRICTLY when BOTH SAE AND PSK are present in the capability string
  const isWpa2Wpa3Transition = hasSae && hasPsk;

  // Pure WPA3: Has SAE or Suite B WITHOUT PSK
  const isPureWpa3 = (hasSae && !hasPsk) || hasSuiteB || (mode.includes('WPA3') && !hasPsk);

  // Mixed WPA2 / WPA3 transition mode (Strictly SAE + PSK)
  if (isWpa2Wpa3Transition) {
    const analysis = generateTechnicalAnalysis(mode, 'WPA2_WPA3', cipherLabel || 'AES-CCMP (128-bit)', keyMgmt, ciphers);
    return {
      type: 'WPA2_WPA3',
      label: 'WPA2 / WPA3 (Transition)',
      color: '#a855f7', // Violet / Fuchsia
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'AES-CCMP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: `WPA2 / WPA3 (Transition) (${cipherLabel || 'AES-CCMP 128-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: 'STANDARD',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Pure WPA3 (SAE or Suite B without PSK)
  if (isPureWpa3) {
    const analysis = generateTechnicalAnalysis(mode, hasSuiteB ? 'WPA3_ENTERPRISE' : 'WPA3', cipherLabel || 'AES-CCMP (128-bit)', keyMgmt, ciphers);
    return {
      type: hasSuiteB ? 'WPA3_ENTERPRISE' : 'WPA3',
      label: hasSuiteB ? 'WPA3 Enterprise (Suite B)' : 'WPA3 (SAE)',
      color: hasSuiteB ? '#6366f1' : '#8b5cf6', // Indigo vs Purple
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'AES-CCMP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: hasSuiteB ? 'WPA3 Enterprise (Suite B)' : `WPA3 (SAE) (${cipherLabel || 'AES-CCMP 128-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: 'MAXIMUM',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Check for WPA1 vs WPA2 PSK presence
  const hasWpa2Psk =
    mode.includes('WPA2-PSK') ||
    mode.includes('RSN-PSK') ||
    mode.includes('[WPA2-PSK') ||
    mode.includes('[RSN-PSK') ||
    mode.includes('[WPA2') ||
    mode.includes('WPA2') ||
    (mode.includes('[RSN') && !hasSae && !isOwe) ||
    (mode.includes('RSN') && !hasSae && !isOwe);

  const hasWpa1Psk =
    mode.includes('WPA-PSK') ||
    mode.includes('[WPA-PSK') ||
    mode.includes('WPA1') ||
    mode.includes('[WPA-') ||
    mode.includes('[WPA]') ||
    (mode.includes('WPA-') && !mode.includes('WPA2-') && !mode.includes('WPA3-'));

  // Mixed WPA1 / WPA2 mode (Both WPA1 and WPA2 elements present)
  if (hasWpa1Psk && hasWpa2Psk) {
    const analysis = generateTechnicalAnalysis(mode, 'WPA_WPA2', cipherLabel || 'AES-CCMP (128-bit) + TKIP', keyMgmt, ciphers);
    return {
      type: 'WPA_WPA2',
      label: 'WPA1 / WPA2 (Mixed)',
      color: '#38bdf8', // Light Sky Blue
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'AES-CCMP (128-bit) + TKIP',
      keyManagement: keyMgmt,
      protocols,
      details: `WPA1 / WPA2 (Mixed) (${cipherLabel || 'AES-CCMP 128-bit + TKIP'})`,
      pmfStatus,
      fastRoaming,
      securityRating: hasTkip ? 'WEAK' : 'STANDARD',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Pure WPA1 (Strictly WPA1 markers without WPA2/RSN)
  if (hasWpa1Psk && !hasWpa2Psk) {
    const analysis = generateTechnicalAnalysis(mode, 'WPA', cipherLabel || 'TKIP (128-bit)', keyMgmt, ciphers);
    return {
      type: 'WPA',
      label: 'WPA1 (PSK)',
      color: '#eab308', // Amber / Yellow
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'TKIP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: `WPA1 (PSK) (${cipherLabel || 'TKIP 128-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: 'WEAK',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Pure WPA2 (WPA2-PSK, RSN-PSK)
  if (hasWpa2Psk || hasPsk) {
    const isHigh = !hasTkip && (pmfStatus !== 'NONE' || hasCcmp256 || fastRoaming);
    const analysis = generateTechnicalAnalysis(mode, 'WPA2', cipherLabel || 'AES-CCMP (128-bit)', keyMgmt, ciphers);
    return {
      type: 'WPA2',
      label: 'WPA2 (PSK)',
      color: '#3b82f6', // Blue
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'AES-CCMP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: `WPA2 (PSK) (${cipherLabel || 'AES-CCMP 128-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: hasTkip ? 'WEAK' : isHigh ? 'HIGH' : 'STANDARD',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  // Fallback Pure WPA1 (e.g. pure WPA)
  if (mode.includes('WPA')) {
    const analysis = generateTechnicalAnalysis(mode, 'WPA', cipherLabel || 'TKIP (128-bit)', keyMgmt, ciphers);
    return {
      type: 'WPA',
      label: 'WPA1 (PSK)',
      color: '#eab308', // Amber / Yellow
      isSecure: true,
      ciphers,
      cipherLabel: cipherLabel || 'TKIP (128-bit)',
      keyManagement: keyMgmt,
      protocols,
      details: `WPA1 (PSK) (${cipherLabel || 'TKIP 128-bit'})`,
      pmfStatus,
      fastRoaming,
      securityRating: 'WEAK',
      technicalAnalysis: analysis.en,
      technicalAnalysisFr: analysis.fr,
      technicalPointsEn: analysis.pointsEn,
      technicalPointsFr: analysis.pointsFr,
    };
  }

  const defaultAnalysis = generateTechnicalAnalysis(mode, 'UNKNOWN', cipherLabel || mode, keyMgmt, ciphers);
  return {
    type: 'UNKNOWN',
    label: mode || 'Unknown',
    color: '#94a3b8', // Gray
    isSecure: true,
    ciphers,
    cipherLabel: cipherLabel || mode,
    keyManagement: keyMgmt,
    protocols,
    details: mode,
    pmfStatus,
    fastRoaming,
    securityRating: 'STANDARD',
    technicalAnalysis: defaultAnalysis.en,
    technicalAnalysisFr: defaultAnalysis.fr,
    technicalPointsEn: defaultAnalysis.pointsEn,
    technicalPointsFr: defaultAnalysis.pointsFr,
  };
}

/**
 * Convert WiFi frequency / channel to accurate band (including 6 GHz WiFi 6E/7)
 */
export function frequencyOrChannelToBand(
  frequency?: number,
  channel?: number | string
): WifiBand {
  const chNum = typeof channel === 'number' ? channel : parseInt(String(channel || '0'), 10);

  // 6 GHz Band (WiFi 6E and WiFi 7: channels 1 to 233, frequencies 5925 - 7125 MHz)
  if (
    (frequency !== undefined && frequency >= 5925 && frequency <= 7125) ||
    (chNum > 177 && chNum <= 233)
  ) {
    return '6 GHz';
  }

  // 5 GHz Band (Channels 32 - 177, frequencies 4900 - 5885 MHz)
  if (
    (frequency !== undefined && frequency >= 4900 && frequency < 5925) ||
    (chNum >= 32 && chNum <= 177)
  ) {
    return '5 GHz';
  }

  // 60 GHz WiGig Band
  if (frequency !== undefined && frequency >= 57000 && frequency <= 71000) {
    return '60 GHz';
  }

  // 2.4 GHz Band (Channels 1 - 14, frequencies 2400 - 2495 MHz)
  return '2.4 GHz';
}

/**
 * Derive WiFi channel number from frequency in MHz based on WiGLE Network.java
 */
export function channelForWiFiFrequencyMhz(frequencyMHz: number): number | undefined {
  if (!frequencyMHz || isNaN(frequencyMHz)) return undefined;
  if (frequencyMHz === 2484) {
    return 14;
  } else if (frequencyMHz <= 2402) {
    return Math.floor((frequencyMHz - 2312) / 5) + 237;
  } else if (frequencyMHz < 2484) {
    return Math.floor((frequencyMHz - 2407) / 5);
  } else if (frequencyMHz >= 4910 && frequencyMHz <= 4980) {
    return Math.floor((frequencyMHz - 4000) / 5);
  } else if (frequencyMHz < 5925) {
    return Math.floor((frequencyMHz - 5000) / 5);
  } else if (frequencyMHz === 5935) {
    return 2;
  } else if (frequencyMHz <= 45000) {
    return Math.floor((frequencyMHz - 5950) / 5);
  } else if (frequencyMHz >= 58320 && frequencyMHz <= 70200) {
    return Math.floor((frequencyMHz - 56160) / 2160);
  }
  return undefined;
}

/**
 * Derive frequency in MHz from WiFi channel number based on WiGLE Network.java
 */
export function channelToFrequency(channel: number | string, band?: string): number | undefined {
  const ch = typeof channel === 'number' ? channel : parseInt(String(channel || '0'), 10);
  if (isNaN(ch) || ch <= 0) return undefined;

  if (band === '6 GHz' || (ch >= 1 && ch <= 233 && band !== '2.4 GHz' && band !== '5 GHz' && ch > 14 && ch !== 36 && ch !== 40 && ch !== 44 && ch !== 48)) {
    if (ch === 2) return 5935;
    if (ch <= 233) return 5950 + ch * 5;
  }

  if (band === '5 GHz' || (ch >= 32 && ch <= 177)) {
    if (ch >= 182 && ch <= 196) {
      return 4000 + ch * 5;
    }
    return 5000 + ch * 5;
  }

  // 2.4 GHz
  if (ch === 14) return 2484;
  if (ch >= 1 && ch <= 13) return 2407 + ch * 5;

  return undefined;
}

/**
 * Parse WiGLE CSV header (Line 1)
 */
export function parseWigleHeader(line: string): WigleCsvHeader {
  const header: WigleCsvHeader = {
    rawLine: line,
  };

  const parts = line.split(',');
  if (parts.length > 0) {
    header.format = parts[0].trim();
  }

  parts.slice(1).forEach((part) => {
    const [key, val] = part.split('=');
    if (!key || !val) return;
    const cleanKey = key.trim().toLowerCase();
    const cleanVal = val.trim();

    switch (cleanKey) {
      case 'apprelease':
        header.appRelease = cleanVal;
        break;
      case 'model':
        header.model = cleanVal;
        break;
      case 'release':
        header.release = cleanVal;
        break;
      case 'device':
        header.device = cleanVal;
        break;
      case 'display':
        header.display = cleanVal;
        break;
      case 'board':
        header.board = cleanVal;
        break;
      case 'brand':
        header.brand = cleanVal;
        break;
      case 'body':
        header.body = cleanVal;
        break;
      case 'subbody':
        header.subBody = cleanVal;
        break;
    }
  });

  return header;
}

/**
 * Detects whether a WiGLE CSV header was generated by the WiGLE web server export or has "WiGLE" in phone model
 */
export function isWigleModel(header?: WigleCsvHeader): boolean {
  if (!header) return false;
  const model = (header.model || '').toLowerCase();
  const device = (header.device || '').toLowerCase();
  const brand = (header.brand || '').toLowerCase();
  const display = (header.display || '').toLowerCase();
  return model.includes('wigle') || device.includes('wigle') || brand.includes('wigle') || display.includes('wigle');
}

/**
 * Normalizes BSSID / MAC address to standard XX:XX:XX:XX:XX:XX uppercase
 */
export function normalizeMac(mac: string): string {
  if (!mac) return '00:00:00:00:00:00';
  const clean = mac.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (clean.length === 12) {
    return clean.match(/.{1,2}/g)?.join(':') || mac.toUpperCase();
  }
  return mac.trim().toUpperCase();
}

/**
 * Parse raw WiGLE CSV string into typed records and header
 */
export function parseWigleCsvString(
  csvContent: string,
  fileName: string,
  customOuiMap: Record<string, string> = {}
): {
  header: WigleCsvHeader;
  rawRecords: WigleRawRecord[];
  accessPoints: ProcessedAccessPoint[];
} {
  const cleanCsv = csvContent.replace(/^\uFEFF/, '').trim();
  const lines = cleanCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse Header (Line 1)
  const header = parseWigleHeader(lines[0]);

  // Find column mapping from line 2
  let colMap: Record<string, number> = {};
  let startIndex = 1;

  const line1Upper = lines.length > 1 ? lines[1].toUpperCase() : '';
  const isHeaderRow =
    line1Upper.includes('MAC') ||
    line1Upper.includes('BSSID') ||
    line1Upper.includes('NETID') ||
    line1Upper.includes('SSID');

  if (lines.length > 1 && isHeaderRow) {
    const colNames = parseCsvLine(lines[1]).map((c) =>
      c.replace(/["'#\uFEFF\r\n]/g, '').trim().toUpperCase()
    );
    colNames.forEach((name, idx) => {
      colMap[name] = idx;
      if (name === 'BSSID' || name === 'NETID') colMap.MAC = idx;
      if (name === 'CAPABILITIES' || name === 'FLAGS' || name === 'SECURITY') colMap.AUTHMODE = idx;
      if (name === 'TIME' || name === 'FIRSTTIME' || name === 'TIMESTAMP') colMap.FIRSTSEEN = idx;
      if (name === 'CH') colMap.CHANNEL = idx;
      if (name === 'FREQ') colMap.FREQUENCY = idx;
      if (name === 'SIGNAL' || name === 'LEVEL' || name === 'BESTLEVEL') colMap.RSSI = idx;
      if (name === 'LAT' || name === 'LATITUDE' || name === 'BESTLAT' || name === 'LASTLAT') colMap.CURRENTLATITUDE = idx;
      if (name === 'LON' || name === 'LNG' || name === 'LONGITUDE' || name === 'BESTLON' || name === 'LASTLON') colMap.CURRENTLONGITUDE = idx;
      if (name === 'ALT' || name === 'ALTITUDE') colMap.ALTITUDEMETERS = idx;
      if (name === 'ACC' || name === 'ACCURACY') colMap.ACCURACYMETERS = idx;
      if (name === 'NETWORKTYPE' || name === 'NETTYPE' || name === 'TYPE') colMap.TYPE = idx;
    });
    startIndex = 2;
  } else {
    // Default standard WiGLE 1.6 schema
    colMap = {
      MAC: 0,
      SSID: 1,
      AUTHMODE: 2,
      FIRSTSEEN: 3,
      CHANNEL: 4,
      FREQUENCY: 5,
      RSSI: 6,
      CURRENTLATITUDE: 7,
      CURRENTLONGITUDE: 8,
      ALTITUDEMETERS: 9,
      ACCURACYMETERS: 10,
      TYPE: 11,
      RCOIS: 12,
      MFGID: 13,
    };
    startIndex = 1;
  }

  const rawRecords: WigleRawRecord[] = [];
  const apMap = new Map<string, ProcessedAccessPoint>();

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#')) continue;

    // Split considering possible quoted strings
    const cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    const rawMac = cols[colMap.MAC ?? 0] || '';
    if (!rawMac || rawMac.length < 5) continue;

    const mac = normalizeMac(rawMac);
    const ssid = (cols[colMap.SSID ?? 1] || '').trim();
    const authMode = cols[colMap.AUTHMODE ?? 2] || '';
    const firstSeen = cols[colMap.FIRSTSEEN ?? 3] || '';
    const isWigleFile = isWigleModel(header);
    const channelRaw = (cols[colMap.CHANNEL ?? 4] || '').trim();
    const hasValidChannel = channelRaw !== '' && channelRaw !== '0';
    const channel = hasValidChannel ? channelRaw : (isWigleFile ? '' : '1');
    const freqRaw = cols[colMap.FREQUENCY ?? 5];
    const frequency = freqRaw && parseInt(freqRaw, 10) > 0 ? parseInt(freqRaw, 10) : (hasValidChannel ? channelToFrequency(channel) : undefined);
    const rssiRaw = cols[colMap.RSSI ?? 6] || '-80';
    const rssi = parseFloat(rssiRaw);
    const latRaw = cols[colMap.CURRENTLATITUDE ?? 7] || '0';
    const lngRaw = cols[colMap.CURRENTLONGITUDE ?? 8] || '0';
    const latitude = parseFloat(latRaw);
    const longitude = parseFloat(lngRaw);
    const altRaw = cols[colMap.ALTITUDEMETERS ?? 9];
    const altitudeMeters = altRaw ? parseFloat(altRaw) : undefined;
    const accRaw = cols[colMap.ACCURACYMETERS ?? 10];
    const accuracyMeters = accRaw ? parseFloat(accRaw) : undefined;

    // Determine Type column index
    let typeColIndex = colMap.TYPE;
    if (typeColIndex === undefined) {
      for (let cIdx = cols.length - 1; cIdx >= 0; cIdx--) {
        const val = (cols[cIdx] || '').replace(/["']/g, '').trim().toUpperCase();
        if (['WIFI', 'GSM', 'LTE', 'WCDMA', 'CDMA', 'NR', 'BT', 'BLE'].includes(val)) {
          typeColIndex = cIdx;
          break;
        }
      }
    }

    let type = (typeColIndex !== undefined && cols[typeColIndex] !== undefined ? cols[typeColIndex] : '')
      .replace(/["']/g, '')
      .trim()
      .toUpperCase();

    // Default to WIFI in WiGLE WiFi CSVs if missing or unpopulated
    if (!type) {
      type = 'WIFI';
    }

    // STRICT FILTER: If type is explicitly cellular or bluetooth, exclude
    if (['GSM', 'LTE', 'WCDMA', 'CDMA', 'NR', 'BT', 'BLE'].includes(type)) {
      continue;
    }

    // Guard against displaced/shifted columns where GSM / LTE appears in other metadata columns
    const hasDisplacedCellular = cols.some((c, idx) => {
      if (idx === (colMap.SSID ?? 1) || idx === (colMap.MAC ?? 0)) return false;
      const u = (c || '').replace(/["']/g, '').trim().toUpperCase();
      return u === 'LTE' || u === 'GSM' || u === 'WCDMA' || u === 'CDMA' || u === 'NR';
    });
    if (hasDisplacedCellular) {
      continue;
    }

    const rcois = cols[colMap.RCOIS ?? 12];
    const mfgId = cols[colMap.MFGID ?? 13];

    const rawRec: WigleRawRecord = {
      mac,
      ssid,
      authMode,
      firstSeen,
      channel,
      frequency,
      rssi: isNaN(rssi) ? -80 : rssi,
      latitude: isNaN(latitude) ? 0 : latitude,
      longitude: isNaN(longitude) ? 0 : longitude,
      altitudeMeters: altitudeMeters !== undefined && !isNaN(altitudeMeters) ? altitudeMeters : undefined,
      accuracyMeters: accuracyMeters !== undefined && !isNaN(accuracyMeters) ? accuracyMeters : undefined,
      type,
      rcois,
      mfgId,
      sourceFile: fileName,
    };

    rawRecords.push(rawRec);

    // Merge into AccessPoint
    const observation: AccessPointObservation = {
      timestamp: firstSeen,
      rssi: rawRec.rssi,
      latitude: rawRec.latitude,
      longitude: rawRec.longitude,
      altitude: rawRec.altitudeMeters,
      accuracy: rawRec.accuracyMeters,
      frequency: rawRec.frequency,
      channel: rawRec.channel,
      sourceFile: fileName,
      ssid: rawRec.ssid,
      authMode: rawRec.authMode,
      isFromWigleFile: isWigleFile,
    };

    if (apMap.has(mac)) {
      const existing = apMap.get(mac)!;
      existing.observationCount += 1;
      existing.observations.push(observation);
      if (!existing.sourceFiles.includes(fileName)) {
        existing.sourceFiles.push(fileName);
      }

      // Best RSSI selection
      if (rawRec.rssi > existing.bestRssi) {
        existing.bestRssi = rawRec.rssi;
        if (rawRec.latitude !== 0 && rawRec.longitude !== 0) {
          existing.latitude = rawRec.latitude;
          existing.longitude = rawRec.longitude;
          existing.altitudeMeters = rawRec.altitudeMeters;
          existing.accuracyMeters = rawRec.accuracyMeters;
        }
      }

      // Update SSID if existing was empty
      if (!existing.ssid && ssid) {
        existing.ssid = ssid;
        existing.isSSIDHidden = false;
      }

      // If complete record from non-WiGLE file:
      if (!isWigleFile) {
        if (existing.isWigleOnly || !existing.hasCompleteDetails) {
          existing.isWigleOnly = false;
          existing.hasCompleteDetails = true;
          existing.authMode = authMode;
          existing.security = classifySecurity(authMode);
          if (hasValidChannel) {
            existing.channel = channel;
            existing.frequency = frequency;
            existing.band = frequencyOrChannelToBand(frequency, channel);
          }
        } else if (authMode.length >= existing.authMode.length) {
          existing.authMode = authMode;
          existing.security = classifySecurity(authMode);
        }
        if (authMode.toUpperCase().includes('WPS')) {
          existing.hasWps = true;
        }
      } else if (existing.isWigleOnly) {
        if (authMode.length > existing.authMode.length) {
          existing.authMode = authMode;
          existing.security = classifySecurity(authMode);
        }
      }

      if (rcois && !existing.rcois) existing.rcois = rcois;
      if (mfgId && !existing.mfgId) existing.mfgId = mfgId;

      if (firstSeen && (!existing.firstSeen || firstSeen < existing.firstSeen)) {
        existing.firstSeen = firstSeen;
      }
      if (firstSeen && (!existing.lastSeen || firstSeen > existing.lastSeen)) {
        existing.lastSeen = firstSeen;
        existing.latestRssi = rawRec.rssi;
      }
    } else {
      const { vendor, oui } = resolveVendor(mac, customOuiMap);
      const security = classifySecurity(authMode);
      const band = hasValidChannel ? frequencyOrChannelToBand(frequency, channel) : (isWigleFile ? 'Unknown' : frequencyOrChannelToBand(frequency, channel));

      const ap: ProcessedAccessPoint = {
        mac,
        oui,
        vendor,
        ssid,
        isSSIDHidden: !ssid || ssid.length === 0,
        hasWps: (authMode || '').toUpperCase().includes('WPS'),
        authMode,
        security,
        channel,
        frequency,
        band,
        firstSeen,
        lastSeen: firstSeen,
        bestRssi: rawRec.rssi,
        latestRssi: rawRec.rssi,
        latitude: rawRec.latitude,
        longitude: rawRec.longitude,
        altitudeMeters: rawRec.altitudeMeters,
        accuracyMeters: rawRec.accuracyMeters,
        rcois,
        mfgId,
        type,
        observationCount: 1,
        observations: [observation],
        sourceFiles: [fileName],
        isWigleOnly: isWigleFile,
        hasCompleteDetails: !isWigleFile && hasValidChannel,
      };

      apMap.set(mac, ap);
    }
  }

  header.totalRows = rawRecords.length;

  synchronizeLatestApObservations(apMap);

  return {
    header,
    rawRecords,
    accessPoints: Array.from(apMap.values()),
  };
}

/**
 * Synchronizes access points with multiple observations so that the main list
 * displays the latest chronological values for SSID, authMode, and security,
 * giving priority to the latest complete observations from non-WiGLE files.
 */
function synchronizeLatestApObservations(apMap: Map<string, ProcessedAccessPoint>) {
  apMap.forEach((ap) => {
    if (ap.observations && ap.observations.length > 0) {
      const sortedObs = [...ap.observations].sort((a, b) => {
        if (!a.timestamp) return -1;
        if (!b.timestamp) return 1;
        return a.timestamp.localeCompare(b.timestamp);
      });

      // Overall latest observation (for timestamp & latest RSSI)
      const latestObs = sortedObs[sortedObs.length - 1];
      if (latestObs) {
        if (latestObs.ssid !== undefined && latestObs.ssid !== null && latestObs.ssid !== '') {
          ap.ssid = latestObs.ssid;
          ap.isSSIDHidden = false;
        }
        if (latestObs.rssi !== undefined) {
          ap.latestRssi = latestObs.rssi;
        }
        if (latestObs.timestamp) {
          ap.lastSeen = latestObs.timestamp;
        }
      }

      const oldestObs = sortedObs[0];
      if (oldestObs && oldestObs.timestamp) {
        ap.firstSeen = oldestObs.timestamp;
      }

      // Best RSSI and GPS coordinates selection across all observations (WiGLE or non-WiGLE)
      let bestObs: AccessPointObservation | null = null;
      for (const obs of sortedObs) {
        if (!bestObs || obs.rssi > bestObs.rssi) {
          bestObs = obs;
        }
      }
      if (bestObs && (bestObs.rssi > ap.bestRssi || ap.bestRssi === 0 || ap.bestRssi === -999)) {
        ap.bestRssi = bestObs.rssi;
        if (bestObs.latitude !== 0 && bestObs.longitude !== 0) {
          ap.latitude = bestObs.latitude;
          ap.longitude = bestObs.longitude;
          ap.altitudeMeters = bestObs.altitude;
          ap.accuracyMeters = bestObs.accuracy;
        }
      }

      // Check for complete observations (from non-WiGLE file)
      const completeObs = sortedObs.filter((o) => !o.isFromWigleFile);
      if (completeObs.length > 0) {
        const latestComplete = completeObs[completeObs.length - 1];
        if (latestComplete.authMode) {
          ap.authMode = latestComplete.authMode;
          ap.security = classifySecurity(latestComplete.authMode);
        }
        if (latestComplete.channel && latestComplete.channel !== '0' && latestComplete.channel !== '') {
          ap.channel = latestComplete.channel;
          if (latestComplete.frequency) {
            ap.frequency = latestComplete.frequency;
            ap.band = frequencyOrChannelToBand(latestComplete.frequency, latestComplete.channel);
          }
        }
        if (latestComplete.authMode && latestComplete.authMode.toUpperCase().includes('WPS')) {
          ap.hasWps = true;
        }
        ap.hasCompleteDetails = true;
        ap.isWigleOnly = false;
      } else {
        // WiGLE only AP
        if (latestObs && latestObs.authMode) {
          ap.authMode = latestObs.authMode;
          ap.security = classifySecurity(latestObs.authMode);
        }
        ap.hasCompleteDetails = false;
        ap.isWigleOnly = true;
      }
    }
  });
}

/**
 * Parses CSV line taking double quotes into account
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Merges multiple CSV scan sessions together
 */
export function mergeScanSessions(
  current: ScanSessionData | null,
  newHeader: WigleCsvHeader,
  newRawRecords: WigleRawRecord[],
  fileName: string,
  customOuiMap: Record<string, string>
): ScanSessionData {
  const newIsWigle = isWigleModel(newHeader);
  const validNewRaw = newRawRecords.filter((r) => {
    const t = (r.type || 'WIFI').trim().toUpperCase();
    return t === 'WIFI' || !['GSM', 'LTE', 'WCDMA', 'CDMA', 'NR', 'BT', 'BLE'].includes(t);
  });

  // Ensure unique file name if user imports multiple files with the same name (e.g. export.csv)
  let distinctFileName = fileName;
  if (current?.files) {
    let suffix = 2;
    while (current.files.includes(distinctFileName)) {
      const extMatch = fileName.match(/(\.[^.]+)$/);
      const base = extMatch ? fileName.substring(0, fileName.length - extMatch[1].length) : fileName;
      const ext = extMatch ? extMatch[1] : '';
      distinctFileName = `${base} (${suffix})${ext}`;
      suffix++;
    }
  }

  const allFiles = current ? [...current.files, distinctFileName] : [distinctFileName];
  const allRaw = current ? [...current.rawRecords, ...validNewRaw] : validNewRaw;

  const updatedFilesMetadata: Record<string, FileMetadata> = {
    ...(current?.filesMetadata || {}),
    [distinctFileName]: {
      fileName: distinctFileName,
      header: newHeader,
      isWigleDevice: newIsWigle,
    },
  };
  if (current?.header && current.files.length > 0 && !current.filesMetadata) {
    const curIsWigle = isWigleModel(current.header);
    current.files.forEach((f) => {
      if (!updatedFilesMetadata[f]) {
        updatedFilesMetadata[f] = {
          fileName: f,
          header: current.header!,
          isWigleDevice: curIsWigle,
        };
      }
    });
  }

  const apMap = new Map<string, ProcessedAccessPoint>();

  // If current session exists, seed apMap
  if (current) {
    current.accessPoints.forEach((ap) => {
      apMap.set(ap.mac, {
        ...ap,
        observations: [...ap.observations],
        sourceFiles: [...ap.sourceFiles],
      });
    });
  }

  // Process new raw records
  validNewRaw.forEach((record) => {
    const mac = record.mac;
    const observation: AccessPointObservation = {
      timestamp: record.firstSeen,
      rssi: record.rssi,
      latitude: record.latitude,
      longitude: record.longitude,
      altitude: record.altitudeMeters,
      accuracy: record.accuracyMeters,
      frequency: record.frequency,
      channel: record.channel,
      sourceFile: record.sourceFile || distinctFileName,
      ssid: record.ssid,
      authMode: record.authMode,
      isFromWigleFile: newIsWigle,
    };

    if (apMap.has(mac)) {
      const existing = apMap.get(mac)!;
      existing.observationCount += 1;
      existing.observations.push(observation);
      const fileToAdd = record.sourceFile || distinctFileName;
      if (!existing.sourceFiles.includes(fileToAdd)) {
        existing.sourceFiles.push(fileToAdd);
      }

      const isValidGps = record.latitude !== 0 && record.longitude !== 0;

      // Best RSSI selection (can come from WiGLE or non-WiGLE file)
      if (record.rssi > existing.bestRssi) {
        existing.bestRssi = record.rssi;
        if (isValidGps) {
          existing.latitude = record.latitude;
          existing.longitude = record.longitude;
          existing.altitudeMeters = record.altitudeMeters;
          existing.accuracyMeters = record.accuracyMeters;
        }
      }

      if (!existing.ssid && record.ssid) {
        existing.ssid = record.ssid;
        existing.isSSIDHidden = false;
      }

      if (!newIsWigle) {
        // Record from a complete (non-WiGLE) file
        if (existing.isWigleOnly || !existing.hasCompleteDetails) {
          existing.isWigleOnly = false;
          existing.hasCompleteDetails = true;
          existing.authMode = record.authMode;
          existing.security = classifySecurity(record.authMode);
          if (record.channel && record.channel !== '0' && record.channel !== '') {
            existing.channel = record.channel;
            if (record.frequency) {
              existing.frequency = record.frequency;
              existing.band = frequencyOrChannelToBand(record.frequency, record.channel);
            }
          }
          if (record.authMode && record.authMode.toUpperCase().includes('WPS')) {
            existing.hasWps = true;
          }
        } else {
          if (record.authMode && record.authMode.length >= existing.authMode.length) {
            existing.authMode = record.authMode;
            existing.security = classifySecurity(record.authMode);
          }
          if (record.channel && record.channel !== '0' && record.channel !== '') {
            existing.channel = record.channel;
            if (record.frequency) {
              existing.frequency = record.frequency;
              existing.band = frequencyOrChannelToBand(record.frequency, record.channel);
            }
          }
          if (record.authMode && record.authMode.toUpperCase().includes('WPS')) {
            existing.hasWps = true;
          }
        }
      } else {
        // Record from a WiGLE file: do NOT degrade if existing already has complete details
        if (existing.isWigleOnly) {
          if (record.authMode && record.authMode.length > existing.authMode.length) {
            existing.authMode = record.authMode;
            existing.security = classifySecurity(record.authMode);
          }
          if (record.channel && record.channel !== '0' && record.channel !== '' && (!existing.channel || existing.channel === '0')) {
            existing.channel = record.channel;
            if (record.frequency) {
              existing.frequency = record.frequency;
              existing.band = frequencyOrChannelToBand(record.frequency, record.channel);
            }
          }
        }
      }

      if (record.rcois && !existing.rcois) existing.rcois = record.rcois;
      if (record.mfgId && !existing.mfgId) existing.mfgId = record.mfgId;

      if (record.firstSeen && (!existing.firstSeen || record.firstSeen < existing.firstSeen)) {
        existing.firstSeen = record.firstSeen;
      }
      if (record.firstSeen && (!existing.lastSeen || record.firstSeen > existing.lastSeen)) {
        existing.lastSeen = record.firstSeen;
        existing.latestRssi = record.rssi;
      }
    } else {
      const { vendor, oui } = resolveVendor(mac, customOuiMap);
      const security = classifySecurity(record.authMode);
      const hasChannel = record.channel !== '0' && record.channel !== '' && record.channel !== undefined;
      const band = hasChannel
        ? frequencyOrChannelToBand(record.frequency, record.channel)
        : (newIsWigle ? 'Unknown' : frequencyOrChannelToBand(record.frequency, record.channel));

      const ap: ProcessedAccessPoint = {
        mac,
        oui,
        vendor,
        ssid: record.ssid,
        isSSIDHidden: !record.ssid || record.ssid.length === 0,
        hasWps: (record.authMode || '').toUpperCase().includes('WPS'),
        authMode: record.authMode,
        security,
        channel: hasChannel ? record.channel : (newIsWigle ? '' : record.channel),
        frequency: record.frequency,
        band,
        firstSeen: record.firstSeen,
        lastSeen: record.firstSeen,
        bestRssi: record.rssi,
        latestRssi: record.rssi,
        latitude: record.latitude,
        longitude: record.longitude,
        altitudeMeters: record.altitudeMeters,
        accuracyMeters: record.accuracyMeters,
        rcois: record.rcois,
        mfgId: record.mfgId,
        type: record.type,
        observationCount: 1,
        observations: [observation],
        sourceFiles: record.sourceFile ? [record.sourceFile] : [distinctFileName],
        isWigleOnly: newIsWigle,
        hasCompleteDetails: !newIsWigle && hasChannel,
      };

      apMap.set(mac, ap);
    }
  });

  synchronizeLatestApObservations(apMap);

  const accessPoints = Array.from(apMap.values());

  // Compute Geo Bounds safely without stack limits
  const validGpsAps = accessPoints.filter((ap) => ap.latitude !== 0 && ap.longitude !== 0);
  let geoBounds: ScanSessionData['geoBounds'] | undefined = undefined;

  if (validGpsAps.length > 0) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (let i = 0; i < validGpsAps.length; i++) {
      const lat = validGpsAps[i].latitude;
      const lng = validGpsAps[i].longitude;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    geoBounds = {
      minLat,
      maxLat,
      minLng,
      maxLng,
      centerLat: (minLat + maxLat) / 2,
      centerLng: (minLng + maxLng) / 2,
    };
  }

  // Choose the most informative header (prefer non-WiGLE header if available)
  let chosenHeader = current?.header || newHeader;
  if (current?.header && isWigleModel(current.header) && !newIsWigle) {
    chosenHeader = newHeader;
  }

  return {
    header: chosenHeader,
    files: allFiles,
    filesMetadata: updatedFilesMetadata,
    rawRecords: allRaw,
    accessPoints,
    loadedAt: new Date().toISOString(),
    geoBounds,
  };
}

/**
 * Re-resolves vendors for existing APs (when custom OUI database is updated)
 */
export function refreshVendors(
  session: ScanSessionData,
  customOuiMap: Record<string, string>
): ScanSessionData {
  const updatedAps = session.accessPoints.map((ap) => {
    const { vendor, oui } = resolveVendor(ap.mac, customOuiMap);
    return {
      ...ap,
      vendor,
      oui,
    };
  });

  return {
    ...session,
    accessPoints: updatedAps,
  };
}
