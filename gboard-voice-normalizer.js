/* Gboard-aware speech normalizer for REMOTO.
   Keeps raw dictation untouched and normalizes only the text sent to the warehouse parser.
   The loaded Master is used as a dictionary, so spaced/mixed-case article codes can be
   recognized without guessing where the article code ends. */
(function installWarehouseGboardNormalizer(){
  'use strict';
  if(window.WarehouseGboardNormalizer)return;

  const VERSION='2026.08.25-gboard-max1';
  const SEP='[\\s,.;:_\\-/]*';
  const DIGIT_WORDS={
    '0':['0','zero'],'1':['1','uno'],'2':['2','due'],'3':['3','tre'],'4':['4','quattro'],
    '5':['5','cinque'],'6':['6','sei'],'7':['7','sette'],'8':['8','otto'],'9':['9','nove']
  };
  const LETTER_WORDS={
    A:['a'],B:['b','bi'],C:['c','ci'],D:['d','di'],E:['e'],F:['f','effe'],G:['g','gi'],H:['h','acca'],
    I:['i'],J:['j'],K:['k','kappa'],L:['l','elle'],M:['m','emme'],N:['n','enne'],O:['o'],P:['p','pi'],
    Q:['q','cu'],R:['r','erre'],S:['s','esse'],T:['t','ti'],U:['u'],V:['v','vi'],W:['w'],X:['x','ics'],
    Y:['y','ipsilon'],Z:['z','zeta']
  };

  const escRe=s=>String(s).replace(/[.*+?^${}()|[\\]\\]/g,'\\$&');
  function canonical(v){
    let s=String(v??'').trim().replace(/[^a-z0-9]/gi,'').toUpperCase();
    if(/^1\\d{3,}/.test(s))s='I'+s.slice(1);
    if(/^\\d{4,}/.test(s))s='I'+s;
    try{if(typeof normalizeArticle==='function')s=normalizeArticle(s,true)||s}catch{}
    return String(s||'').toUpperCase();
  }
  function knownArticles(){
    const out=new Set();
    try{for(const r of db?.master?.rows||[]){const a=canonical(r?.article_base||r?.articolo||r?.article||'');if(a)out.add(a)}}catch{}
    try{if(typeof stockBuckets==='function')for(const r of stockBuckets()||[]){const a=canonical(r?.article_base||'');if(a)out.add(a)}}catch{}
    return [...out].filter(a=>/^I\\d{3,}/.test(a)).sort((a,b)=>b.length-a.length);
  }
  function charPart(ch){
    if(DIGIT_WORDS[ch])return '(?:'+DIGIT_WORDS[ch].map(escRe).join('|')+')';
    const arr=LETTER_WORDS[ch]||[ch.toLowerCase()];return '(?:'+arr.map(escRe).join('|')+')';
  }
  function articleRegex(article){
    const body=canonical(article).replace(/^I/,'');
    const parts=[...body].map(charPart).join(SEP);
    return new RegExp('\\b(?:(?:i|1)'+SEP+')?'+parts+'\\b','gi');
  }
  function normalizeKnown(raw){
    let text=String(raw??'');
    for(const article of knownArticles()){
      try{text=text.replace(articleRegex(article),article)}catch{}
    }
    return text;
  }
  function normalizeCompactCodes(raw){
    return String(raw??'').replace(/\\b(?:i|1)\\s*(\\d(?:[\\s._-]*\\d){3,})(?:\\s+([a-z]{2,10}))?\\b/gi,(m,d,suffix='')=>{
      const digits=String(d).replace(/\\D/g,'');
      if(digits.length<4)return m;
      return 'I'+digits+String(suffix||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
    }).replace(/\\b[i1](\\d{3,}[a-z0-9]{0,16})\\b/gi,(m,body)=>'I'+String(body).toUpperCase());
  }
  function tidy(raw){return String(raw??'').replace(/[“”„]/g,'"').replace(/[’`]/g,"'").replace(/\\s+/g,' ').trim()}
  function normalize(raw){return tidy(normalizeCompactCodes(normalizeKnown(raw)))}
  function preview(raw){
    const normalized=normalize(raw),codes=[];
    const known=new Set(knownArticles());
    for(const m of normalized.matchAll(/\\bI\\d{3,}[A-Z0-9]*\\b/g)){const c=canonical(m[0]);if(c&&!codes.includes(c))codes.push(c)}
    return {raw:String(raw??''),normalized,codes,knownCodes:codes.filter(c=>known.has(c))};
  }
  function patch(){
    const voice=window.WarehouseVoiceCommands;
    if(!voice||voice.__gboardNormalizerPatched)return false;
    const base=voice.executeTranscript.bind(voice);
    voice.executeTranscript=function(raw,hint){return base(normalize(raw),hint)};
    voice.__gboardNormalizerPatched=true;
    return true;
  }
  function install(){return patch()}

  window.WarehouseGboardNormalizer={version:VERSION,canonical,knownArticles,normalize,preview,patch,install};
  install();
})();