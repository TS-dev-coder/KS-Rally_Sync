/**
 * Renders every view in every shipped language and inspects what the player
 * would actually see.
 *
 * The coverage test counts keys; it cannot tell that a key is present but
 * renders "{name}" verbatim, or that t() fell through and painted the key name
 * itself onto a button. Those are the two failures translation actually
 * produces, and both are invisible to anyone who does not read the language.
 * So this walks the real DOM instead of the dictionary.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let JSDOM = null;
try {
  ({ JSDOM } = require('jsdom'));
} catch (err) {
  test('i18n sweep skipped — jsdom not installed', { skip: true }, () => {});
}

const ROOT = path.join(__dirname, '..');
const SCRIPTS = (() => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1].split('?')[0]);
})();

async function boot(language) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8765/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  // scrollTo is unimplemented in jsdom and app.go() calls it on every switch
  dom.window.scrollTo = () => {};
  for (const file of SCRIPTS) {
    dom.window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  }
  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.addEventListener('load', resolve, { once: true });
  });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  const RS = dom.window.RallySync;
  RS.state.updateSettings({ language });
  RS.app.refresh();
  return { dom, window: dom.window, RS };
}

/** Text a player reads: leaf elements plus the attributes screen readers speak. */
function visibleStrings(doc) {
  const out = [];
  doc.querySelectorAll('body *').forEach((node) => {
    if (node.children.length === 0 && node.textContent.trim()) {
      out.push({ what: node.tagName.toLowerCase(), text: node.textContent.trim() });
    }
    ['aria-label', 'title', 'placeholder'].forEach((attr) => {
      const v = node.getAttribute && node.getAttribute(attr);
      if (v && v.trim()) out.push({ what: node.tagName.toLowerCase() + '[' + attr + ']', text: v.trim() });
    });
  });
  return out;
}

const maybe = JSDOM ? test : test.skip;

maybe('every view in every language renders without a leaked placeholder or a raw key', async () => {
  // One boot, switching language in place. Booting per language cost minutes
  // and tested something no player does; switching is the actual path, and it
  // also catches text that was built once at load and never re-rendered.
  const ctx = await boot('en');
  const doc = ctx.window.document;
  const languages = ctx.RS.i18n.LANGUAGES.map((l) => l.code);
  const keySet = new Set(Object.keys(ctx.RS.i18n.KEYS));
  // Sections only -- clicking the language button would open its sheet.
  const TABS = '#nav .nav-btn:not(.nav-lang)';
  const tabCount = doc.querySelectorAll(TABS).length;

  assert.ok(languages.length >= 17, 'expected the full language list, got ' + languages.length);
  assert.ok(tabCount >= 5, 'expected the nav to render');

  const problems = [];

  for (const code of languages) {
    ctx.RS.state.updateSettings({ language: code });
    ctx.RS.app.refresh();

    for (let i = 0; i < tabCount; i++) {
      const btn = doc.querySelectorAll(TABS)[i];
      btn.dispatchEvent(new ctx.window.Event('click', { bubbles: true }));

      // Open every collapsible so panel text is actually in the tree.
      doc.querySelectorAll('details').forEach((el) => { el.open = true; });
      doc.querySelectorAll('summary, .guide-head, [aria-expanded="false"]').forEach((el) => {
        try { el.dispatchEvent(new ctx.window.Event('click', { bubbles: true })); } catch (e) { /* not clickable */ }
      });

      const where = code + ' tab#' + i;
      visibleStrings(doc).forEach(({ what, text }) => {
        // Lower-initial only. Every real placeholder is a lowercase identifier
        // -- {name}, {seconds}, {n} -- while "{Squad}" in the roster-paste guide
        // is literal text the player TYPES into their own list. Matching any
        // braced word flagged the instruction as a bug.
        if (/\{[a-z]\w*\}/.test(text)) {
          problems.push(where + ' ' + what + ' leaked placeholder: ' + text.slice(0, 70));
        }
        // t() returns the key itself when a key is missing from English too
        if (keySet.has(text)) {
          problems.push(where + ' ' + what + ' rendered the key name: ' + text);
        }
        if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(text)) {
          problems.push(where + ' ' + what + ' rendered a broken value: ' + text.slice(0, 70));
        }
      });
    }
  }
  ctx.window.close();

  assert.deepStrictEqual(problems, [],
    problems.length + ' rendering problems:\n' + problems.slice(0, 40).join('\n'));
});

maybe('right-to-left languages set the document direction, not just the words', async () => {
  // Arabic text in a left-to-right container renders punctuation on the wrong
  // side; the whole document has to flip, so assert the attribute the CSS keys off.
  const ar = await boot('ar');
  assert.strictEqual(ar.window.document.documentElement.getAttribute('dir'), 'rtl');
  ar.window.close();

  const en = await boot('en');
  const dir = en.window.document.documentElement.getAttribute('dir');
  assert.ok(dir === 'ltr' || dir === null, 'expected ltr, got ' + dir);
  en.window.close();
});

maybe('the language menu offers every language in its own name', async () => {
  // A player who cannot read the current language has to find their own in the
  // list, so the label must be the endonym, never the English name.
  const ctx = await boot('en');
  const names = ctx.RS.i18n.LANGUAGES.map((l) => l.native);
  assert.ok(names.every((n) => n && n.trim()), 'every language needs a native name');
  assert.ok(names.includes('日本語') && names.includes('العربية') && names.includes('Русский'),
    'names must be endonyms: ' + names.join(', '));
  // The menu must actually show the native name, not the English one.
  const shown = [...ctx.window.document.querySelectorAll('option, .lang-name, [data-lang]')]
    .map((n) => n.textContent.trim());
  if (shown.length) {
    assert.ok(names.some((n) => shown.includes(n)),
      'the language menu renders none of the native names');
  }
  ctx.window.close();
});

maybe('no figure label overflows the drawing it sits in', () => {
  // The figures are a fixed 260-unit viewBox. A translated caption that runs
  // long does not wrap or shrink -- SVG text just spills past the phone outline
  // and off the card. Every translator was asked to keep these short, which is
  // a hope, not a check. This is the check.
  //
  // Width is estimated at 0.52 em per character, which is close for the Latin
  // scripts that actually run long here. CJK is wider per glyph but uses far
  // fewer of them, so the estimate stays conservative in the direction that
  // matters.
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'howto.js'), 'utf8');
  const VIEWBOX = 260;
  const PER_CHAR = 0.52;

  require(path.join(__dirname, '..', 'js', 'i18n.js'));
  const dir = path.join(__dirname, '..', 'js', 'locale');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .forEach((f) => require(path.join(dir, f)));
  const T = globalThis.RallySync.i18n;

  // Two shapes, two budgets. label(x, …) is left-anchored, so it may use only
  // the room to its right. caption(y, …) is centred at 130, so it grows both
  // ways and gets the full width -- which is why the step captions were moved
  // to it: their x had been tuned to the length of the English string.
  const anchored = [...src.matchAll(
    /label\((\d+(?:\.\d+)?),\s*\d+(?:\.\d+)?,\s*F\('([\w.]+)'\)(?:,\s*(\d+(?:\.\d+)?))?\)/g)]
    .map((m) => ({ x: Number(m[1]), short: m[2], size: Number(m[3] || 8) }));
  const centred = [...src.matchAll(
    /caption\(\d+(?:\.\d+)?,\s*F\('([\w.]+)'\)(?:,\s*(\d+(?:\.\d+)?))?(?:,\s*(\d+(?:\.\d+)?))?\)/g)]
    .map((m) => ({
      centred: true, short: m[1], size: Number(m[2] || 8.5),
      at: m[3] === undefined ? 130 : Number(m[3])
    }));

  // A few labels sit beside drawn furniture rather than in open space, so the
  // viewBox is not their real limit. fig.targetOnMap ran into the target-info
  // panel in four languages -- and English was touching it -- while still being
  // comfortably inside 260.
  const BOUNDARY = { 'fig.targetOnMap': 150 };

  assert.ok(anchored.length > 10, 'expected the anchored labels, got ' + anchored.length);
  const stepCaptions = centred.filter((c) => /^fig\.step\d$/.test(c.short));
  assert.strictEqual(stepCaptions.length, 7, 'expected one centred caption per step');

  const overflow = [];
  anchored.concat(centred).forEach(({ x, short, size, centred: isCentred }) => {
    const key = 'howto.' + short;
    T.LANGUAGES.forEach((lang) => {
      const table = lang.code === 'en' ? T.KEYS : (T.DICT[lang.code] || {});
      const text = table[key];
      if (!text) return;                       // falls back to English, measured there
      // CJK advances about a full em per glyph but uses far fewer of them;
      // Thai tone marks and vowel signs stack rather than advance.
      const glyphs = String(text).replace(/[ัิ-ฺ็-๎]/g, '');
      const cjk = (glyphs.match(/[　-鿿가-힯]/g) || []).length;
      const width = (cjk * 1.0 + (glyphs.length - cjk) * PER_CHAR) * size;
      const right = isCentred ? 130 + width / 2 : x + width;
      if (right > VIEWBOX) {
        overflow.push(lang.code + ' ' + key + ': ends at ~' + Math.round(right) +
          ', limit ' + VIEWBOX + ' — ' + JSON.stringify(text));
      }
    });
  });

  assert.deepStrictEqual(overflow, [],
    'these figure labels run off the drawing; shorten them:\n' + overflow.join('\n'));
});

maybe('no figure label collides with the control drawn next to it', () => {
  // Three translators measured this by hand and each asked for it to be re-run
  // after any rewording. The labels inside the drawn chips are the tight ones:
  // SVG text is neither wrapped nor clipped, so a longer translation simply
  // runs across the button beside it. Nothing errors, and a diff looks fine.
  //
  // Spanish "Movilización" for Rally is twelve characters where English has
  // five, and it ran straight through the Attack button. That is why the chip
  // labels are centred now -- a centred label grows both ways, so its budget is
  // the gap between its neighbours rather than the room to its right.
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'howto.js'), 'utf8');
  const PER_CHAR = 0.52;

  require(path.join(__dirname, '..', 'js', 'i18n.js'));
  const dir = path.join(__dirname, '..', 'js', 'locale');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .forEach((f) => require(path.join(dir, f)));
  const T = globalThis.RallySync.i18n;

  const chips = [...src.matchAll(/chip\((\d+), (\d+), (\d+), (\d+)/g)]
    .map((m) => ({ x: +m[1], y: +m[2], w: +m[3] }));

  // A chip and the caption centred in it are written on ONE line. Anchoring the
  // join to spaces and tabs keeps a caption on the following line from being
  // mistaken for this chip's label.
  const pattern =
    // [^\n]*? rather than [^\n)]* : a chip's fill argument contains parentheses
    // of its own, as in var(--accent-soft), and stopping at the first ")" left
    // most of the chips unmatched while the test still looked like it ran.
    /chip\((\d+), (\d+), (\d+), \d+[^\n]*?\)[ \t]*\+[ \t]*caption\(\d+, (?:F\('([\w.]+)'\)|T\.t\('([\w.]+)'\)), (\d+(?:\.\d+)?), (\d+)\)/g;
  const inChip = [...src.matchAll(pattern)].map((m) => ({
    chipX: +m[1], chipY: +m[2], chipW: +m[3],
    key: m[4] ? 'howto.' + m[4] : m[5],
    size: +m[6], centre: +m[7]
  }));

  assert.ok(inChip.length >= 8, 'expected captions drawn inside chips, found ' + inChip.length);

  const problems = [];
  inChip.forEach((lab) => {
    const row = chips.filter((c) => c.y === lab.chipY);
    const rightward = row.filter((c) => c.x > lab.chipX).map((c) => c.x);
    const leftward = row.filter((c) => c.x < lab.chipX).map((c) => c.x + c.w);
    const rightLimit = rightward.length ? Math.min(...rightward) : lab.chipX + lab.chipW + 8;
    const leftLimit = leftward.length ? Math.max(...leftward) : 0;

    T.LANGUAGES.forEach((lang) => {
      const table = lang.code === 'en' ? T.KEYS : (T.DICT[lang.code] || {});
      const text = table[lab.key] || (lang.code === 'en' ? null : T.KEYS[lab.key]);
      if (!text) return;
      const glyphs = String(text).replace(/[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/g, '');
      const cjk = (glyphs.match(/[\u3000-\u9fff\uac00-\ud7af]/g) || []).length;
      const width = (cjk * 1.0 + (glyphs.length - cjk) * PER_CHAR) * lab.size;
      const right = lab.centre + width / 2;
      const left = lab.centre - width / 2;
      if (right > rightLimit || left < leftLimit) {
        problems.push(lang.code + ' ' + lab.key + ': spans ' + Math.round(left) + '-' +
          Math.round(right) + ', room is ' + leftLimit + '-' + rightLimit +
          ' - ' + JSON.stringify(text));
      }
    });
  });

  assert.deepStrictEqual(problems, [],
    'these figure labels run into the control beside them; shorten them:\n' +
    problems.join('\n'));
});

maybe('the shared plan table stays aligned in every language', () => {
  // This block is pasted into Discord, so it is read by more people than the
  // screen it came from -- and it is monospace, so a header one column too wide
  // shifts every row beneath it.
  //
  // The trap is that a CJK glyph is ONE UTF-16 unit but TWO monospace columns.
  // padRight and trim both measure display width now, but that was a bug in
  // padRight first and survived in trim afterwards, and neither failure showed
  // up as an error -- the table just quietly stopped lining up. Two reviewers
  // found it by rendering the block; this checks it without anyone having to.
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'views', 'calculate.js'), 'utf8');

  // Budgets come from the call site, so they cannot drift from the code.
  const budgets = {};
  const pattern = /trim\(T\.t\('(share\.col\w+)'\), (\d+)\)/g;
  let m;
  while ((m = pattern.exec(src)) !== null) budgets[m[1]] = Number(m[2]);
  assert.strictEqual(Object.keys(budgets).length, 5,
    'expected five column headers, found ' + Object.keys(budgets).length);

  function displayWidth(text) {
    let width = 0;
    const str = String(text);
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) { width += 2; i++; continue; }
      const wide =
        (code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0x303e) ||
        (code >= 0x3041 && code <= 0x33ff) || (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0x4e00 && code <= 0x9fff) || (code >= 0xa000 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe6f) || (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6);
      width += wide ? 2 : 1;
    }
    return width;
  }

  require(path.join(__dirname, '..', 'js', 'i18n.js'));
  const dir = path.join(__dirname, '..', 'js', 'locale');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .forEach((f) => require(path.join(dir, f)));
  const T = globalThis.RallySync.i18n;

  // Anything over budget would be truncated with an ellipsis rather than
  // misaligning -- but a truncated header is still a broken header, so treat
  // the budget as the limit rather than relying on the trim to hide it.
  const problems = [];
  T.LANGUAGES.forEach((lang) => {
    const table = lang.code === 'en' ? T.KEYS : (T.DICT[lang.code] || {});
    Object.keys(budgets).forEach((key) => {
      const text = table[key] || T.KEYS[key];
      const width = displayWidth(text);
      if (width > budgets[key]) {
        problems.push(lang.code + ' ' + key + ': ' + width + ' columns, budget ' +
          budgets[key] + ' — ' + JSON.stringify(text));
      }
    });
  });

  assert.deepStrictEqual(problems, [],
    'these table headers overflow their column:\n' + problems.join('\n'));
});

maybe('strings that compose into other strings still read correctly', () => {
  // Suggested by a reviewer after the same class of defect appeared four times,
  // and it is the sharpest observation anyone made about this codebase: every
  // late bug lived in a SEAM, not in a string. Each one looked perfectly valid
  // in the dictionary and only broke once composed with its real neighbours.
  //
  //   Polish   {badge} injected an adjective after another adjective
  //   Thai     {buffer} repeated the verb already in the frame
  //   Russian  a clause carrying an internal ";" joined by ";"
  //   Japanese ASCII ", " sitting between two Japanese clauses
  //
  // So compose them here with arguments they can actually receive, and check
  // the seams rather than the pieces.
  require(path.join(__dirname, '..', 'js', 'i18n.js'));
  const dir = path.join(__dirname, '..', 'js', 'locale');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .forEach((f) => require(path.join(dir, f)));
  const T = globalThis.RallySync.i18n;

  const problems = [];

  T.LANGUAGES.forEach((lang) => {
    T.setLanguage(lang.code);
    const t = (key, params) => T.t(key, params);

    // Every shape the extrapolation list can take, including the mixed
    // one/many pair that is likeliest to expose a mismatch.
    const warnings = [
      [t('calc.diagonalMany', { n: 2 }), t('calc.offSpeedOne', { n: 1, speeds: '45' })],
      [t('calc.diagonalOne', { n: 1 }), t('calc.beyondMany', { n: 3 })],
      [t('calc.offSpeedMany', { n: 2, speeds: '5/+25' })]
    ].map((parts) =>
      t('calc.extrapolating', { list: parts.join(t('calc.listJoiner')) }));

    const composed = warnings.concat([
      // a reason from state.js landing inside a calibrate frame
      t('cal.zoneNotRefitted', { zone: t('zone.general'), reason: t('state.noUsableFit') }),
      t('cal.zoneNotRefitted', { zone: t('zone.monster'), reason: t('state.noSamples') }),
      // a factor built from one key and spliced into another
      t('cal.modelWasOff', { time: '3m 33s', factor: t('cal.tooSlow', { n: '1.42' }) }),
      t('cal.modelWasOff', { time: '3m 33s', factor: t('cal.tooFast', { n: '2.10' }) }),
      // the unnamed fallbacks, which sit mid-sentence
      t('confirm.deleteLead', { name: t('common.thisLead') }),
      t('confirm.deleteTarget', { name: t('common.thisTarget') }),
      t('cal.leadMissingData', { name: t('common.thatLead') }),
      t('cal.targetNoCoords', { name: t('common.thatTarget') }),
      // the spoken callout with the fallback standing in for a name
      t('speech.rallyIn', { name: t('focus.rallyFallback'), seconds: 30 }),
      t('speech.goNow', { name: t('focus.rallyFallback') })
    ]);

    composed.forEach((text) => {
      const where = lang.code + ': ' + text.slice(0, 80);
      if (/\{\w+\}/.test(text)) problems.push(where + '  [leaked placeholder]');
      // Two sentence-enders in a row means a frame and its argument each
      // supplied one. Any script, including the CJK and Arabic marks.
      if (/([.;:،؛。；、！？])\s*\1/.test(text)) problems.push(where + '  [doubled punctuation]');
      if (/\s{2,}/.test(text)) problems.push(where + '  [double space]');
      if (/[.。；;]\s*[,،、]/.test(text)) problems.push(where + '  [comma after a full stop]');
      // A Latin comma or semicolon inside otherwise CJK or Arabic prose is the
      // mixed-script typo that started this whole line of enquiry.
      if (/[\u3040-\u30ff\u4e00-\u9fff\u0600-\u06ff]/.test(text) && /[,;](?!\s*\d)/.test(text)) {
        problems.push(where + '  [Latin punctuation in non-Latin prose]');
      }
    });
  });

  T.setLanguage('en');
  assert.deepStrictEqual(problems, [],
    problems.length + ' composition problems:\n' + problems.slice(0, 30).join('\n'));
});
