/**
 * i18n.js — the app in the languages Kingshot itself ships in.
 *
 * The language list is not invented: it is exactly the seventeen locales the
 * Kingshot App Store listing declares, so anyone who can read the game can read
 * this. Arabic is right-to-left and flips the whole layout.
 *
 * Deliberately a plain lookup with an English fallback rather than a framework.
 * A missing key renders the English string instead of a blank or a raw key, so
 * a half-translated locale degrades into a readable mix rather than a broken
 * screen — which matters because translations arrive a few at a time.
 */
;(function (root) {
  'use strict';

  /** Exactly the locales Kingshot lists on the App Store, English first. */
  var LANGUAGES = [
    { code: 'en', native: 'English', english: 'English' },
    { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true },
    { code: 'de', native: 'Deutsch', english: 'German' },
    { code: 'es', native: 'Español', english: 'Spanish' },
    { code: 'fr', native: 'Français', english: 'French' },
    { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian' },
    { code: 'it', native: 'Italiano', english: 'Italian' },
    { code: 'ja', native: '日本語', english: 'Japanese' },
    { code: 'ko', native: '한국어', english: 'Korean' },
    { code: 'pl', native: 'Polski', english: 'Polish' },
    { code: 'pt', native: 'Português', english: 'Portuguese' },
    { code: 'ru', native: 'Русский', english: 'Russian' },
    { code: 'th', native: 'ไทย', english: 'Thai' },
    { code: 'tr', native: 'Türkçe', english: 'Turkish' },
    { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
    { code: 'zh-Hans', native: '简体中文', english: 'Simplified Chinese' },
    { code: 'zh-Hant', native: '繁體中文', english: 'Traditional Chinese' }
  ];

  /**
   * English is the key set. Every other locale is a partial overlay: anything
   * it omits falls through to here.
   */
  var EN = {
    'nav.calculate': 'Calculate',
    'nav.leads': 'Leads',
    'nav.targets': 'Targets',
    'nav.tune': 'Tune',
    'nav.more': 'More',

    'row.on': 'on',
    'row.type': 'type',
    'row.march': 'march',
    'row.departs': 'departs',
    'row.lands': 'lands',
    'row.from': 'from',
    'row.to': 'to',
    'row.dist': 'dist',
    'row.speed': 'speed',
    'row.power': 'power',

    'badge.measured': 'measured',
    'badge.calibrated': 'calibrated',
    'badge.estimated': 'estimated',
    'badge.blocked': 'blocked',

    'btn.focus': 'Focus',
    'btn.share': 'Share link',
    'btn.copy': 'Copy',
    'btn.copied': 'Copied',
    'btn.copyFailed': 'Copy failed',
    'btn.linkCopied': 'Link copied',
    'btn.exactTime': 'Exact time',
    'btn.exactSet': 'Exact set',
    'btn.setExact': 'Set exact',
    'btn.clear': 'Clear',

    'head.launchOrder': 'Launch order',
    'head.target': 'Target',
    'head.mode': 'Mode',
    'head.timing': 'Timing',
    'head.eventSetups': 'Event setups',
    'head.language': 'Language',

    'mode.sync': 'Sync',
    'mode.syncSub': 'All land together',
    'mode.sequence': 'Sequence',
    'mode.sequenceSub': 'Staggered, gapless',

    'label.tapRallyAt': 'TAP RALLY AT',
    'label.marchAt': 'MARCH AT',
    'label.untilYouGo': 'until you go',
    'label.gone': 'gone',
    'label.noGrouping': 'No grouping',
    'label.alarmOn': 'Alarm on',
    'label.alarmOff': 'Alarm off',

    'common.add': 'Add',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.cancel': 'Cancel',
    'common.done': 'Done',
    'common.edit': 'Edit',
    'common.name': 'Name',
    'common.alliance': 'Alliance',
    'common.language': 'Language',
    'common.none': 'None'
  };

  /**
   * Overlays. Kept terse on purpose: these are read on a phone, mid-event, by
   * someone about to tap a button, so the game's own wording is preferred over
   * a more literal translation wherever the two differ.
   */
  var DICT = {
    ar: {
      'nav.calculate': 'احسب', 'nav.leads': 'القادة', 'nav.targets': 'الأهداف', 'nav.tune': 'ضبط', 'nav.more': 'المزيد',
      'row.on': 'على', 'row.type': 'النوع', 'row.march': 'المسير', 'row.departs': 'المغادرة', 'row.lands': 'الوصول',
      'row.from': 'من', 'row.to': 'إلى', 'row.dist': 'المسافة', 'row.speed': 'السرعة', 'row.power': 'القوة',
      'badge.measured': 'مقاس', 'badge.calibrated': 'معاير', 'badge.estimated': 'تقديري', 'badge.blocked': 'محجوب',
      'btn.focus': 'تركيز', 'btn.share': 'مشاركة الرابط', 'btn.copy': 'نسخ', 'btn.copied': 'تم النسخ',
      'btn.copyFailed': 'فشل النسخ', 'btn.linkCopied': 'تم نسخ الرابط', 'btn.exactTime': 'الوقت الدقيق',
      'btn.exactSet': 'تم التعيين', 'btn.setExact': 'تعيين دقيق', 'btn.clear': 'مسح',
      'head.launchOrder': 'ترتيب الانطلاق', 'head.target': 'الهدف', 'head.mode': 'الوضع', 'head.timing': 'التوقيت',
      'head.eventSetups': 'إعدادات الحدث', 'head.language': 'اللغة',
      'mode.sync': 'متزامن', 'mode.syncSub': 'الوصول معًا', 'mode.sequence': 'تسلسلي', 'mode.sequenceSub': 'متتابع بلا فجوات',
      'label.tapRallyAt': 'اضغط الحشد في', 'label.marchAt': 'سِر في', 'label.untilYouGo': 'حتى الانطلاق',
      'label.gone': 'انطلق', 'label.noGrouping': 'بدون تجميع', 'label.alarmOn': 'المنبه يعمل', 'label.alarmOff': 'المنبه متوقف',
      'common.add': 'إضافة', 'common.save': 'حفظ', 'common.delete': 'حذف', 'common.cancel': 'إلغاء', 'common.done': 'تم',
      'common.edit': 'تعديل', 'common.name': 'الاسم', 'common.alliance': 'التحالف', 'common.language': 'اللغة', 'common.none': 'لا شيء'
    },
    de: {
      'nav.calculate': 'Berechnen', 'nav.leads': 'Anführer', 'nav.targets': 'Ziele', 'nav.tune': 'Feintuning', 'nav.more': 'Mehr',
      'row.on': 'auf', 'row.type': 'Typ', 'row.march': 'Marsch', 'row.departs': 'Abmarsch', 'row.lands': 'Ankunft',
      'row.from': 'von', 'row.to': 'nach', 'row.dist': 'Distanz', 'row.speed': 'Tempo', 'row.power': 'Macht',
      'badge.measured': 'gemessen', 'badge.calibrated': 'kalibriert', 'badge.estimated': 'geschätzt', 'badge.blocked': 'blockiert',
      'btn.focus': 'Fokus', 'btn.share': 'Link teilen', 'btn.copy': 'Kopieren', 'btn.copied': 'Kopiert',
      'btn.copyFailed': 'Fehlgeschlagen', 'btn.linkCopied': 'Link kopiert', 'btn.exactTime': 'Genaue Zeit',
      'btn.exactSet': 'Gesetzt', 'btn.setExact': 'Übernehmen', 'btn.clear': 'Löschen',
      'head.launchOrder': 'Startreihenfolge', 'head.target': 'Ziel', 'head.mode': 'Modus', 'head.timing': 'Zeitplan',
      'head.eventSetups': 'Event-Vorlagen', 'head.language': 'Sprache',
      'mode.sync': 'Synchron', 'mode.syncSub': 'Alle kommen gleichzeitig an', 'mode.sequence': 'Staffel', 'mode.sequenceSub': 'Versetzt, ohne Lücke',
      'label.tapRallyAt': 'SAMMLUNG STARTEN UM', 'label.marchAt': 'LOSMARSCHIEREN UM', 'label.untilYouGo': 'bis zum Start',
      'label.gone': 'gestartet', 'label.noGrouping': 'Keine Gruppierung', 'label.alarmOn': 'Alarm an', 'label.alarmOff': 'Alarm aus',
      'common.add': 'Hinzufügen', 'common.save': 'Speichern', 'common.delete': 'Löschen', 'common.cancel': 'Abbrechen',
      'common.done': 'Fertig', 'common.edit': 'Bearbeiten', 'common.name': 'Name', 'common.alliance': 'Allianz',
      'common.language': 'Sprache', 'common.none': 'Keine'
    },
    es: {
      'nav.calculate': 'Calcular', 'nav.leads': 'Líderes', 'nav.targets': 'Objetivos', 'nav.tune': 'Ajustes', 'nav.more': 'Más',
      'row.on': 'a', 'row.type': 'tipo', 'row.march': 'marcha', 'row.departs': 'sale', 'row.lands': 'llega',
      'row.from': 'desde', 'row.to': 'hasta', 'row.dist': 'dist', 'row.speed': 'veloc', 'row.power': 'poder',
      'badge.measured': 'medido', 'badge.calibrated': 'calibrado', 'badge.estimated': 'estimado', 'badge.blocked': 'bloqueado',
      'btn.focus': 'Enfocar', 'btn.share': 'Compartir enlace', 'btn.copy': 'Copiar', 'btn.copied': 'Copiado',
      'btn.copyFailed': 'Error al copiar', 'btn.linkCopied': 'Enlace copiado', 'btn.exactTime': 'Tiempo exacto',
      'btn.exactSet': 'Exacto fijado', 'btn.setExact': 'Fijar exacto', 'btn.clear': 'Borrar',
      'head.launchOrder': 'Orden de salida', 'head.target': 'Objetivo', 'head.mode': 'Modo', 'head.timing': 'Horario',
      'head.eventSetups': 'Configuraciones', 'head.language': 'Idioma',
      'mode.sync': 'Sincronizado', 'mode.syncSub': 'Llegan a la vez', 'mode.sequence': 'Secuencia', 'mode.sequenceSub': 'Escalonado, sin huecos',
      'label.tapRallyAt': 'PULSA REUNIÓN A LAS', 'label.marchAt': 'MARCHA A LAS', 'label.untilYouGo': 'para salir',
      'label.gone': 'salió', 'label.noGrouping': 'Sin agrupar', 'label.alarmOn': 'Alarma activada', 'label.alarmOff': 'Alarma desactivada',
      'common.add': 'Añadir', 'common.save': 'Guardar', 'common.delete': 'Eliminar', 'common.cancel': 'Cancelar',
      'common.done': 'Listo', 'common.edit': 'Editar', 'common.name': 'Nombre', 'common.alliance': 'Alianza',
      'common.language': 'Idioma', 'common.none': 'Ninguna'
    },
    fr: {
      'nav.calculate': 'Calculer', 'nav.leads': 'Chefs', 'nav.targets': 'Cibles', 'nav.tune': 'Réglages', 'nav.more': 'Plus',
      'row.on': 'sur', 'row.type': 'type', 'row.march': 'marche', 'row.departs': 'départ', 'row.lands': 'arrivée',
      'row.from': 'de', 'row.to': 'vers', 'row.dist': 'dist', 'row.speed': 'vitesse', 'row.power': 'puissance',
      'badge.measured': 'mesuré', 'badge.calibrated': 'calibré', 'badge.estimated': 'estimé', 'badge.blocked': 'bloqué',
      'btn.focus': 'Focus', 'btn.share': 'Partager le lien', 'btn.copy': 'Copier', 'btn.copied': 'Copié',
      'btn.copyFailed': 'Échec de la copie', 'btn.linkCopied': 'Lien copié', 'btn.exactTime': 'Temps exact',
      'btn.exactSet': 'Exact défini', 'btn.setExact': 'Définir', 'btn.clear': 'Effacer',
      'head.launchOrder': 'Ordre de départ', 'head.target': 'Cible', 'head.mode': 'Mode', 'head.timing': 'Horaires',
      'head.eventSetups': 'Configurations', 'head.language': 'Langue',
      'mode.sync': 'Simultané', 'mode.syncSub': 'Arrivée groupée', 'mode.sequence': 'Séquence', 'mode.sequenceSub': 'Échelonné, sans trou',
      'label.tapRallyAt': 'LANCER LE RALLIEMENT À', 'label.marchAt': 'MARCHER À', 'label.untilYouGo': 'avant le départ',
      'label.gone': 'parti', 'label.noGrouping': 'Sans regroupement', 'label.alarmOn': 'Alarme activée', 'label.alarmOff': 'Alarme désactivée',
      'common.add': 'Ajouter', 'common.save': 'Enregistrer', 'common.delete': 'Supprimer', 'common.cancel': 'Annuler',
      'common.done': 'Terminé', 'common.edit': 'Modifier', 'common.name': 'Nom', 'common.alliance': 'Alliance',
      'common.language': 'Langue', 'common.none': 'Aucune'
    },
    id: {
      'nav.calculate': 'Hitung', 'nav.leads': 'Pemimpin', 'nav.targets': 'Target', 'nav.tune': 'Setelan', 'nav.more': 'Lainnya',
      'row.on': 'ke', 'row.type': 'tipe', 'row.march': 'perjalanan', 'row.departs': 'berangkat', 'row.lands': 'tiba',
      'row.from': 'dari', 'row.to': 'ke', 'row.dist': 'jarak', 'row.speed': 'kecepatan', 'row.power': 'kekuatan',
      'badge.measured': 'terukur', 'badge.calibrated': 'terkalibrasi', 'badge.estimated': 'perkiraan', 'badge.blocked': 'terhalang',
      'btn.focus': 'Fokus', 'btn.share': 'Bagikan tautan', 'btn.copy': 'Salin', 'btn.copied': 'Tersalin',
      'btn.copyFailed': 'Gagal menyalin', 'btn.linkCopied': 'Tautan disalin', 'btn.exactTime': 'Waktu pasti',
      'btn.exactSet': 'Sudah diatur', 'btn.setExact': 'Atur pasti', 'btn.clear': 'Hapus',
      'head.launchOrder': 'Urutan berangkat', 'head.target': 'Target', 'head.mode': 'Mode', 'head.timing': 'Waktu',
      'head.eventSetups': 'Pengaturan event', 'head.language': 'Bahasa',
      'mode.sync': 'Serentak', 'mode.syncSub': 'Tiba bersamaan', 'mode.sequence': 'Berurutan', 'mode.sequenceSub': 'Bertahap, tanpa jeda',
      'label.tapRallyAt': 'TEKAN RALLY PADA', 'label.marchAt': 'BERANGKAT PADA', 'label.untilYouGo': 'sampai berangkat',
      'label.gone': 'sudah', 'label.noGrouping': 'Tanpa grup', 'label.alarmOn': 'Alarm aktif', 'label.alarmOff': 'Alarm mati',
      'common.add': 'Tambah', 'common.save': 'Simpan', 'common.delete': 'Hapus', 'common.cancel': 'Batal',
      'common.done': 'Selesai', 'common.edit': 'Ubah', 'common.name': 'Nama', 'common.alliance': 'Aliansi',
      'common.language': 'Bahasa', 'common.none': 'Tidak ada'
    },
    it: {
      'nav.calculate': 'Calcola', 'nav.leads': 'Capi', 'nav.targets': 'Bersagli', 'nav.tune': 'Taratura', 'nav.more': 'Altro',
      'row.on': 'su', 'row.type': 'tipo', 'row.march': 'marcia', 'row.departs': 'parte', 'row.lands': 'arriva',
      'row.from': 'da', 'row.to': 'a', 'row.dist': 'dist', 'row.speed': 'velocità', 'row.power': 'potenza',
      'badge.measured': 'misurato', 'badge.calibrated': 'calibrato', 'badge.estimated': 'stimato', 'badge.blocked': 'bloccato',
      'btn.focus': 'Focus', 'btn.share': 'Condividi link', 'btn.copy': 'Copia', 'btn.copied': 'Copiato',
      'btn.copyFailed': 'Copia non riuscita', 'btn.linkCopied': 'Link copiato', 'btn.exactTime': 'Tempo esatto',
      'btn.exactSet': 'Esatto impostato', 'btn.setExact': 'Imposta', 'btn.clear': 'Cancella',
      'head.launchOrder': 'Ordine di partenza', 'head.target': 'Bersaglio', 'head.mode': 'Modalità', 'head.timing': 'Orari',
      'head.eventSetups': 'Configurazioni', 'head.language': 'Lingua',
      'mode.sync': 'Sincrono', 'mode.syncSub': 'Arrivano insieme', 'mode.sequence': 'Sequenza', 'mode.sequenceSub': 'Scaglionato, senza vuoti',
      'label.tapRallyAt': 'AVVIA RADUNO ALLE', 'label.marchAt': 'MARCIA ALLE', 'label.untilYouGo': 'alla partenza',
      'label.gone': 'partito', 'label.noGrouping': 'Nessun raggruppamento', 'label.alarmOn': 'Sveglia attiva', 'label.alarmOff': 'Sveglia spenta',
      'common.add': 'Aggiungi', 'common.save': 'Salva', 'common.delete': 'Elimina', 'common.cancel': 'Annulla',
      'common.done': 'Fatto', 'common.edit': 'Modifica', 'common.name': 'Nome', 'common.alliance': 'Alleanza',
      'common.language': 'Lingua', 'common.none': 'Nessuna'
    },
    ja: {
      'nav.calculate': '計算', 'nav.leads': '隊長', 'nav.targets': '目標', 'nav.tune': '調整', 'nav.more': 'その他',
      'row.on': '対象', 'row.type': '種類', 'row.march': '行軍', 'row.departs': '出発', 'row.lands': '到着',
      'row.from': '出発地', 'row.to': '目的地', 'row.dist': '距離', 'row.speed': '速度', 'row.power': '戦力',
      'badge.measured': '実測', 'badge.calibrated': '較正済み', 'badge.estimated': '推定', 'badge.blocked': '迂回',
      'btn.focus': 'フォーカス', 'btn.share': 'リンクを共有', 'btn.copy': 'コピー', 'btn.copied': 'コピーしました',
      'btn.copyFailed': 'コピー失敗', 'btn.linkCopied': 'リンクをコピー', 'btn.exactTime': '実測時間',
      'btn.exactSet': '設定済み', 'btn.setExact': '設定', 'btn.clear': 'クリア',
      'head.launchOrder': '出撃順', 'head.target': '目標', 'head.mode': 'モード', 'head.timing': '時刻',
      'head.eventSetups': 'イベント設定', 'head.language': '言語',
      'mode.sync': '同時', 'mode.syncSub': '同時に到着', 'mode.sequence': '連続', 'mode.sequenceSub': '間隔なしで順次',
      'label.tapRallyAt': '集結を開始', 'label.marchAt': '行軍開始', 'label.untilYouGo': '出発まで',
      'label.gone': '出発済み', 'label.noGrouping': 'グループなし', 'label.alarmOn': 'アラームオン', 'label.alarmOff': 'アラームオフ',
      'common.add': '追加', 'common.save': '保存', 'common.delete': '削除', 'common.cancel': 'キャンセル',
      'common.done': '完了', 'common.edit': '編集', 'common.name': '名前', 'common.alliance': '同盟',
      'common.language': '言語', 'common.none': 'なし'
    },
    ko: {
      'nav.calculate': '계산', 'nav.leads': '지휘관', 'nav.targets': '목표', 'nav.tune': '보정', 'nav.more': '더보기',
      'row.on': '대상', 'row.type': '유형', 'row.march': '행군', 'row.departs': '출발', 'row.lands': '도착',
      'row.from': '출발지', 'row.to': '목적지', 'row.dist': '거리', 'row.speed': '속도', 'row.power': '전투력',
      'badge.measured': '실측', 'badge.calibrated': '보정됨', 'badge.estimated': '추정', 'badge.blocked': '우회',
      'btn.focus': '집중', 'btn.share': '링크 공유', 'btn.copy': '복사', 'btn.copied': '복사됨',
      'btn.copyFailed': '복사 실패', 'btn.linkCopied': '링크 복사됨', 'btn.exactTime': '정확한 시간',
      'btn.exactSet': '설정됨', 'btn.setExact': '설정', 'btn.clear': '지우기',
      'head.launchOrder': '출발 순서', 'head.target': '목표', 'head.mode': '모드', 'head.timing': '시각',
      'head.eventSetups': '이벤트 설정', 'head.language': '언어',
      'mode.sync': '동시', 'mode.syncSub': '동시 도착', 'mode.sequence': '순차', 'mode.sequenceSub': '간격 없이 연속',
      'label.tapRallyAt': '집결 시작 시각', 'label.marchAt': '행군 시각', 'label.untilYouGo': '출발까지',
      'label.gone': '출발함', 'label.noGrouping': '그룹 없음', 'label.alarmOn': '알람 켜짐', 'label.alarmOff': '알람 꺼짐',
      'common.add': '추가', 'common.save': '저장', 'common.delete': '삭제', 'common.cancel': '취소',
      'common.done': '완료', 'common.edit': '편집', 'common.name': '이름', 'common.alliance': '연맹',
      'common.language': '언어', 'common.none': '없음'
    },
    pl: {
      'nav.calculate': 'Oblicz', 'nav.leads': 'Dowódcy', 'nav.targets': 'Cele', 'nav.tune': 'Kalibracja', 'nav.more': 'Więcej',
      'row.on': 'na', 'row.type': 'typ', 'row.march': 'marsz', 'row.departs': 'wyrusza', 'row.lands': 'dociera',
      'row.from': 'z', 'row.to': 'do', 'row.dist': 'dyst', 'row.speed': 'prędkość', 'row.power': 'moc',
      'badge.measured': 'zmierzone', 'badge.calibrated': 'skalibrowane', 'badge.estimated': 'szacowane', 'badge.blocked': 'objazd',
      'btn.focus': 'Skup', 'btn.share': 'Udostępnij link', 'btn.copy': 'Kopiuj', 'btn.copied': 'Skopiowano',
      'btn.copyFailed': 'Błąd kopiowania', 'btn.linkCopied': 'Link skopiowany', 'btn.exactTime': 'Dokładny czas',
      'btn.exactSet': 'Ustawiono', 'btn.setExact': 'Ustaw', 'btn.clear': 'Wyczyść',
      'head.launchOrder': 'Kolejność startu', 'head.target': 'Cel', 'head.mode': 'Tryb', 'head.timing': 'Czas',
      'head.eventSetups': 'Ustawienia wydarzeń', 'head.language': 'Język',
      'mode.sync': 'Równocześnie', 'mode.syncSub': 'Docierają razem', 'mode.sequence': 'Sekwencja', 'mode.sequenceSub': 'Kolejno, bez przerw',
      'label.tapRallyAt': 'ROZPOCZNIJ ZBIÓRKĘ O', 'label.marchAt': 'WYMARSZ O', 'label.untilYouGo': 'do wymarszu',
      'label.gone': 'wyruszył', 'label.noGrouping': 'Bez grupowania', 'label.alarmOn': 'Alarm włączony', 'label.alarmOff': 'Alarm wyłączony',
      'common.add': 'Dodaj', 'common.save': 'Zapisz', 'common.delete': 'Usuń', 'common.cancel': 'Anuluj',
      'common.done': 'Gotowe', 'common.edit': 'Edytuj', 'common.name': 'Nazwa', 'common.alliance': 'Sojusz',
      'common.language': 'Język', 'common.none': 'Brak'
    },
    pt: {
      'nav.calculate': 'Calcular', 'nav.leads': 'Líderes', 'nav.targets': 'Alvos', 'nav.tune': 'Ajuste', 'nav.more': 'Mais',
      'row.on': 'em', 'row.type': 'tipo', 'row.march': 'marcha', 'row.departs': 'parte', 'row.lands': 'chega',
      'row.from': 'de', 'row.to': 'para', 'row.dist': 'dist', 'row.speed': 'veloc', 'row.power': 'poder',
      'badge.measured': 'medido', 'badge.calibrated': 'calibrado', 'badge.estimated': 'estimado', 'badge.blocked': 'bloqueado',
      'btn.focus': 'Focar', 'btn.share': 'Partilhar link', 'btn.copy': 'Copiar', 'btn.copied': 'Copiado',
      'btn.copyFailed': 'Falha ao copiar', 'btn.linkCopied': 'Link copiado', 'btn.exactTime': 'Tempo exato',
      'btn.exactSet': 'Exato definido', 'btn.setExact': 'Definir', 'btn.clear': 'Limpar',
      'head.launchOrder': 'Ordem de partida', 'head.target': 'Alvo', 'head.mode': 'Modo', 'head.timing': 'Horários',
      'head.eventSetups': 'Configurações', 'head.language': 'Idioma',
      'mode.sync': 'Sincronizado', 'mode.syncSub': 'Chegam juntos', 'mode.sequence': 'Sequência', 'mode.sequenceSub': 'Escalonado, sem intervalo',
      'label.tapRallyAt': 'TOQUE EM REUNIR ÀS', 'label.marchAt': 'MARCHAR ÀS', 'label.untilYouGo': 'até partir',
      'label.gone': 'partiu', 'label.noGrouping': 'Sem agrupamento', 'label.alarmOn': 'Alarme ligado', 'label.alarmOff': 'Alarme desligado',
      'common.add': 'Adicionar', 'common.save': 'Guardar', 'common.delete': 'Eliminar', 'common.cancel': 'Cancelar',
      'common.done': 'Concluído', 'common.edit': 'Editar', 'common.name': 'Nome', 'common.alliance': 'Aliança',
      'common.language': 'Idioma', 'common.none': 'Nenhuma'
    },
    ru: {
      'nav.calculate': 'Расчёт', 'nav.leads': 'Лидеры', 'nav.targets': 'Цели', 'nav.tune': 'Настройка', 'nav.more': 'Ещё',
      'row.on': 'на', 'row.type': 'тип', 'row.march': 'марш', 'row.departs': 'выход', 'row.lands': 'прибытие',
      'row.from': 'откуда', 'row.to': 'куда', 'row.dist': 'расст', 'row.speed': 'скорость', 'row.power': 'мощь',
      'badge.measured': 'измерено', 'badge.calibrated': 'откалибровано', 'badge.estimated': 'оценка', 'badge.blocked': 'обход',
      'btn.focus': 'Фокус', 'btn.share': 'Поделиться', 'btn.copy': 'Копировать', 'btn.copied': 'Скопировано',
      'btn.copyFailed': 'Ошибка копирования', 'btn.linkCopied': 'Ссылка скопирована', 'btn.exactTime': 'Точное время',
      'btn.exactSet': 'Задано', 'btn.setExact': 'Задать', 'btn.clear': 'Очистить',
      'head.launchOrder': 'Порядок выхода', 'head.target': 'Цель', 'head.mode': 'Режим', 'head.timing': 'Время',
      'head.eventSetups': 'Наборы события', 'head.language': 'Язык',
      'mode.sync': 'Синхронно', 'mode.syncSub': 'Прибывают вместе', 'mode.sequence': 'Последовательно', 'mode.sequenceSub': 'По очереди, без пауз',
      'label.tapRallyAt': 'НАЖАТЬ СБОР В', 'label.marchAt': 'ВЫСТУПИТЬ В', 'label.untilYouGo': 'до выхода',
      'label.gone': 'вышел', 'label.noGrouping': 'Без группировки', 'label.alarmOn': 'Будильник вкл', 'label.alarmOff': 'Будильник выкл',
      'common.add': 'Добавить', 'common.save': 'Сохранить', 'common.delete': 'Удалить', 'common.cancel': 'Отмена',
      'common.done': 'Готово', 'common.edit': 'Изменить', 'common.name': 'Имя', 'common.alliance': 'Альянс',
      'common.language': 'Язык', 'common.none': 'Нет'
    },
    th: {
      'nav.calculate': 'คำนวณ', 'nav.leads': 'ผู้นำ', 'nav.targets': 'เป้าหมาย', 'nav.tune': 'ปรับค่า', 'nav.more': 'เพิ่มเติม',
      'row.on': 'ที่', 'row.type': 'ประเภท', 'row.march': 'เดินทัพ', 'row.departs': 'ออกเดินทาง', 'row.lands': 'ถึง',
      'row.from': 'จาก', 'row.to': 'ไป', 'row.dist': 'ระยะ', 'row.speed': 'ความเร็ว', 'row.power': 'พลัง',
      'badge.measured': 'วัดจริง', 'badge.calibrated': 'ปรับเทียบแล้ว', 'badge.estimated': 'ประมาณ', 'badge.blocked': 'อ้อม',
      'btn.focus': 'โฟกัส', 'btn.share': 'แชร์ลิงก์', 'btn.copy': 'คัดลอก', 'btn.copied': 'คัดลอกแล้ว',
      'btn.copyFailed': 'คัดลอกไม่สำเร็จ', 'btn.linkCopied': 'คัดลอกลิงก์แล้ว', 'btn.exactTime': 'เวลาจริง',
      'btn.exactSet': 'ตั้งค่าแล้ว', 'btn.setExact': 'ตั้งค่า', 'btn.clear': 'ล้าง',
      'head.launchOrder': 'ลำดับออกเดินทาง', 'head.target': 'เป้าหมาย', 'head.mode': 'โหมด', 'head.timing': 'เวลา',
      'head.eventSetups': 'ค่าตั้งอีเวนต์', 'head.language': 'ภาษา',
      'mode.sync': 'พร้อมกัน', 'mode.syncSub': 'ถึงพร้อมกัน', 'mode.sequence': 'ตามลำดับ', 'mode.sequenceSub': 'ทยอย ไม่มีช่องว่าง',
      'label.tapRallyAt': 'กดรวมพลเวลา', 'label.marchAt': 'เดินทัพเวลา', 'label.untilYouGo': 'ก่อนออก',
      'label.gone': 'ออกแล้ว', 'label.noGrouping': 'ไม่จัดกลุ่ม', 'label.alarmOn': 'เปิดเตือน', 'label.alarmOff': 'ปิดเตือน',
      'common.add': 'เพิ่ม', 'common.save': 'บันทึก', 'common.delete': 'ลบ', 'common.cancel': 'ยกเลิก',
      'common.done': 'เสร็จ', 'common.edit': 'แก้ไข', 'common.name': 'ชื่อ', 'common.alliance': 'พันธมิตร',
      'common.language': 'ภาษา', 'common.none': 'ไม่มี'
    },
    tr: {
      'nav.calculate': 'Hesapla', 'nav.leads': 'Liderler', 'nav.targets': 'Hedefler', 'nav.tune': 'İnce ayar', 'nav.more': 'Daha fazla',
      'row.on': 'hedef', 'row.type': 'tür', 'row.march': 'yürüyüş', 'row.departs': 'çıkış', 'row.lands': 'varış',
      'row.from': 'nereden', 'row.to': 'nereye', 'row.dist': 'mesafe', 'row.speed': 'hız', 'row.power': 'güç',
      'badge.measured': 'ölçüldü', 'badge.calibrated': 'kalibre', 'badge.estimated': 'tahmini', 'badge.blocked': 'dolambaçlı',
      'btn.focus': 'Odak', 'btn.share': 'Bağlantıyı paylaş', 'btn.copy': 'Kopyala', 'btn.copied': 'Kopyalandı',
      'btn.copyFailed': 'Kopyalanamadı', 'btn.linkCopied': 'Bağlantı kopyalandı', 'btn.exactTime': 'Kesin süre',
      'btn.exactSet': 'Kesin ayarlandı', 'btn.setExact': 'Ayarla', 'btn.clear': 'Temizle',
      'head.launchOrder': 'Çıkış sırası', 'head.target': 'Hedef', 'head.mode': 'Mod', 'head.timing': 'Zamanlama',
      'head.eventSetups': 'Etkinlik ayarları', 'head.language': 'Dil',
      'mode.sync': 'Eşzamanlı', 'mode.syncSub': 'Birlikte varır', 'mode.sequence': 'Sıralı', 'mode.sequenceSub': 'Kademeli, boşluksuz',
      'label.tapRallyAt': 'TOPLANMAYA BAS', 'label.marchAt': 'YÜRÜYÜŞ SAATİ', 'label.untilYouGo': 'çıkışa kalan',
      'label.gone': 'çıktı', 'label.noGrouping': 'Gruplama yok', 'label.alarmOn': 'Alarm açık', 'label.alarmOff': 'Alarm kapalı',
      'common.add': 'Ekle', 'common.save': 'Kaydet', 'common.delete': 'Sil', 'common.cancel': 'İptal',
      'common.done': 'Bitti', 'common.edit': 'Düzenle', 'common.name': 'Ad', 'common.alliance': 'İttifak',
      'common.language': 'Dil', 'common.none': 'Yok'
    },
    vi: {
      'nav.calculate': 'Tính toán', 'nav.leads': 'Chỉ huy', 'nav.targets': 'Mục tiêu', 'nav.tune': 'Hiệu chỉnh', 'nav.more': 'Thêm',
      'row.on': 'vào', 'row.type': 'loại', 'row.march': 'hành quân', 'row.departs': 'xuất phát', 'row.lands': 'đến nơi',
      'row.from': 'từ', 'row.to': 'đến', 'row.dist': 'k.cách', 'row.speed': 'tốc độ', 'row.power': 'lực chiến',
      'badge.measured': 'đã đo', 'badge.calibrated': 'đã hiệu chỉnh', 'badge.estimated': 'ước tính', 'badge.blocked': 'đi vòng',
      'btn.focus': 'Tập trung', 'btn.share': 'Chia sẻ liên kết', 'btn.copy': 'Sao chép', 'btn.copied': 'Đã sao chép',
      'btn.copyFailed': 'Sao chép lỗi', 'btn.linkCopied': 'Đã sao chép liên kết', 'btn.exactTime': 'Thời gian chính xác',
      'btn.exactSet': 'Đã đặt', 'btn.setExact': 'Đặt', 'btn.clear': 'Xóa',
      'head.launchOrder': 'Thứ tự xuất quân', 'head.target': 'Mục tiêu', 'head.mode': 'Chế độ', 'head.timing': 'Thời gian',
      'head.eventSetups': 'Thiết lập sự kiện', 'head.language': 'Ngôn ngữ',
      'mode.sync': 'Đồng thời', 'mode.syncSub': 'Đến cùng lúc', 'mode.sequence': 'Tuần tự', 'mode.sequenceSub': 'Nối tiếp, không hở',
      'label.tapRallyAt': 'NHẤN TẬP HỢP LÚC', 'label.marchAt': 'HÀNH QUÂN LÚC', 'label.untilYouGo': 'trước khi đi',
      'label.gone': 'đã đi', 'label.noGrouping': 'Không nhóm', 'label.alarmOn': 'Báo thức bật', 'label.alarmOff': 'Báo thức tắt',
      'common.add': 'Thêm', 'common.save': 'Lưu', 'common.delete': 'Xóa', 'common.cancel': 'Hủy',
      'common.done': 'Xong', 'common.edit': 'Sửa', 'common.name': 'Tên', 'common.alliance': 'Liên minh',
      'common.language': 'Ngôn ngữ', 'common.none': 'Không'
    },
    'zh-Hans': {
      'nav.calculate': '计算', 'nav.leads': '队长', 'nav.targets': '目标', 'nav.tune': '校准', 'nav.more': '更多',
      'row.on': '目标', 'row.type': '类型', 'row.march': '行军', 'row.departs': '出发', 'row.lands': '抵达',
      'row.from': '起点', 'row.to': '终点', 'row.dist': '距离', 'row.speed': '速度', 'row.power': '战力',
      'badge.measured': '实测', 'badge.calibrated': '已校准', 'badge.estimated': '估算', 'badge.blocked': '绕行',
      'btn.focus': '聚焦', 'btn.share': '分享链接', 'btn.copy': '复制', 'btn.copied': '已复制',
      'btn.copyFailed': '复制失败', 'btn.linkCopied': '链接已复制', 'btn.exactTime': '精确时间',
      'btn.exactSet': '已设置', 'btn.setExact': '设置', 'btn.clear': '清除',
      'head.launchOrder': '出击顺序', 'head.target': '目标', 'head.mode': '模式', 'head.timing': '时间',
      'head.eventSetups': '活动预设', 'head.language': '语言',
      'mode.sync': '同时', 'mode.syncSub': '同时抵达', 'mode.sequence': '连续', 'mode.sequenceSub': '依次，无间隔',
      'label.tapRallyAt': '点击集结时间', 'label.marchAt': '行军时间', 'label.untilYouGo': '距出发',
      'label.gone': '已出发', 'label.noGrouping': '不分组', 'label.alarmOn': '闹钟开', 'label.alarmOff': '闹钟关',
      'common.add': '添加', 'common.save': '保存', 'common.delete': '删除', 'common.cancel': '取消',
      'common.done': '完成', 'common.edit': '编辑', 'common.name': '名称', 'common.alliance': '联盟',
      'common.language': '语言', 'common.none': '无'
    },
    'zh-Hant': {
      'nav.calculate': '計算', 'nav.leads': '隊長', 'nav.targets': '目標', 'nav.tune': '校準', 'nav.more': '更多',
      'row.on': '目標', 'row.type': '類型', 'row.march': '行軍', 'row.departs': '出發', 'row.lands': '抵達',
      'row.from': '起點', 'row.to': '終點', 'row.dist': '距離', 'row.speed': '速度', 'row.power': '戰力',
      'badge.measured': '實測', 'badge.calibrated': '已校準', 'badge.estimated': '估算', 'badge.blocked': '繞行',
      'btn.focus': '聚焦', 'btn.share': '分享連結', 'btn.copy': '複製', 'btn.copied': '已複製',
      'btn.copyFailed': '複製失敗', 'btn.linkCopied': '連結已複製', 'btn.exactTime': '精確時間',
      'btn.exactSet': '已設定', 'btn.setExact': '設定', 'btn.clear': '清除',
      'head.launchOrder': '出擊順序', 'head.target': '目標', 'head.mode': '模式', 'head.timing': '時間',
      'head.eventSetups': '活動預設', 'head.language': '語言',
      'mode.sync': '同時', 'mode.syncSub': '同時抵達', 'mode.sequence': '連續', 'mode.sequenceSub': '依序，無間隔',
      'label.tapRallyAt': '點擊集結時間', 'label.marchAt': '行軍時間', 'label.untilYouGo': '距出發',
      'label.gone': '已出發', 'label.noGrouping': '不分組', 'label.alarmOn': '鬧鐘開', 'label.alarmOff': '鬧鐘關',
      'common.add': '新增', 'common.save': '儲存', 'common.delete': '刪除', 'common.cancel': '取消',
      'common.done': '完成', 'common.edit': '編輯', 'common.name': '名稱', 'common.alliance': '聯盟',
      'common.language': '語言', 'common.none': '無'
    }
  };

  var current = 'en';

  function known(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  /**
   * Best match for a browser tag. "pt-BR" takes Portuguese, "zh-TW" and "zh-HK"
   * take Traditional rather than falling back to Simplified, which would be
   * readable but wrong.
   */
  function resolve(tag) {
    if (!tag) return null;
    var raw = String(tag);
    var lower = raw.toLowerCase();
    if (known(raw)) return raw;
    if (lower.indexOf('zh') === 0) {
      return /hant|tw|hk|mo/.test(lower) ? 'zh-Hant' : 'zh-Hans';
    }
    var base = lower.split('-')[0];
    return known(base) ? base : null;
  }

  /** The first browser preference the app can actually speak. */
  function detect() {
    var nav = root.navigator || {};
    var list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
    for (var i = 0; i < list.length; i++) {
      var hit = resolve(list[i]);
      if (hit) return hit;
    }
    return 'en';
  }

  /**
   * Look up a key. Falls back to English, then to the key itself — a missing
   * translation should read as English, never as a blank button.
   */
  function t(key, params) {
    var table = DICT[current] || {};
    var text = table[key];
    if (text === undefined) text = EN[key];
    if (text === undefined) return key;
    if (params) {
      Object.keys(params).forEach(function (name) {
        text = text.split('{' + name + '}').join(params[name]);
      });
    }
    return text;
  }

  function setLanguage(code) {
    current = known(code) ? code : 'en';
    var def = known(current);
    var doc = root.document;
    if (doc && doc.documentElement) {
      doc.documentElement.setAttribute('lang', current);
      doc.documentElement.setAttribute('dir', def && def.rtl ? 'rtl' : 'ltr');
    }
    return current;
  }

  function language() { return current; }
  function isRtl() { var d = known(current); return !!(d && d.rtl); }

  /** How much of the key set a locale actually covers, for the picker. */
  function coverage(code) {
    if (code === 'en') return 1;
    var table = DICT[code];
    if (!table) return 0;
    var keys = Object.keys(EN);
    var have = 0;
    for (var i = 0; i < keys.length; i++) if (table[keys[i]] !== undefined) have++;
    return have / keys.length;
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.i18n = {
    LANGUAGES: LANGUAGES,
    KEYS: EN,
    DICT: DICT,
    t: t,
    detect: detect,
    resolve: resolve,
    setLanguage: setLanguage,
    language: language,
    isRtl: isRtl,
    coverage: coverage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
