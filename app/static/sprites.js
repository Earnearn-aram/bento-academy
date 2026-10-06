/* 16-bit pixel food. One character = one pixel, "." = transparent. Module icons come from module.toml `icon`. */
const PAL={
  K:"#3b2a20",                         // outline
  W:"#ffffff",w:"#e6dccb",             // rice / white + shade
  D:"#2f3b2f",d:"#4f6352",             // nori + highlight
  R:"#c8453a",r:"#9b2f27",h:"#e8735f", // lacquer red: base, shadow, highlight
  T:"#e9b866",L:"#f7e2a8",             // broth, noodles
  Y:"#f5c542",y:"#d9a21f",             // yolk / tamago + shade
  P:"#f4a6b8",p:"#d97a93",             // pink + shade
  M:"#8fb56f",m:"#5f8a45",             // green + shade
  O:"#f28c5c",o:"#d0663a",S:"#ffd8c4", // salmon base, shade, fat stripe
  N:"#d9984f",n:"#a8692c",             // baked batter + shade
  B:"#8a5530",                         // wood
  C:"#fff7e6",c:"#ead7b6"              // bun dough + shade
};
/* 16-bit style: 16px grid, outline, 2-3 shades per colour. "." = transparent. */
const SPRITES={
  onigiri:[
    "................",
    ".......KK.......",
    "......KWWK......",
    ".....KWWWWK.....",
    "....KWWWWWWK....",
    "....KWWWWWwK....",
    "...KWWWWWWwwK...",
    "...KWWWWWWWwK...",
    "..KWWWWWWWWwwK..",
    "..KWWWDDDDWWwK..",
    ".KWWWWDdDDWWwwK.",
    ".KWWWWDdDDWWWwK.",
    "KWWWWWDdDDWWWwwK",
    "KwWWWWDDDDWWWwwK",
    ".KwwwwDDDDwwwwK.",
    "..KKKKKKKKKKKK.."],
  ramen:[
    "..........B..B..",
    ".........B..B...",
    "........B..B....",
    "..KKKKKKKKKKKK..",
    ".KLLTMTPPTWWTLK.",
    "KTLLTMPpPTWYYWTK",
    "KhRRRRRRRRRRRRrK",
    "KhRRWRRRWRRRWRrK",
    ".KhRRRRRRRRRRrK.",
    ".KhRRRRRRRRRRrK.",
    "..KRRRRRRRRRrK..",
    "...KKrrrrrrKK...",
    "....KBBBBBBK....",
    "....KKKKKKKK....",
    "................",
    "................"],
  dango:[
    "....BB....",
    "..KKKKKK..",
    ".KPWPPPpK.",
    ".KPPPPPpK.",
    "..KppppK..",
    "..KKKKKK..",
    ".KWWWWWwK.",
    ".KWWWWWwK.",
    "..KwwwwK..",
    "..KKKKKK..",
    ".KMWMMMmK.",
    ".KMMMMMmK.",
    "..KmmmmK..",
    "...KBBK...",
    "....BB....",
    "....BB...."],
  sushi:[
    "...KKKKKKKKKK...",
    "..KOOSOOOSOOOK..",
    ".KOOOSOOOSOOOoK.",
    "KoOOOOSOOOSOOooK",
    "KWWWWWWDDWWWWWwK",
    "KWWWWWWDdWWWWwwK",
    "KwWWWWWDDWWWWwwK",
    ".KwwwwwDDwwwwwK.",
    "..KKKKKKKKKKKK.."],
  taiyaki:[
    ".....KKKKKK.....",
    "...KKNNNNNNKK.KK",
    "..KNYYNNnNNNNKNK",
    ".KNYKNNNnNnNNNNK",
    "KNNNNNNnNnNnNNnK",
    "KNNNNnNnNnNnNNNK",
    ".KnNNNNNnNnNNNnK",
    "..KnnNNNNNNNnKnK",
    "...KKnnnnnnnKK.K",
    ".....KKKKKKK...."],
  bento:[
    "KKKKKKKKKKKKKKKK",
    "KhRRRRRRRRRRRRrK",
    "KRKKKKKKKKKKKKrK",
    "KRKWWWWWKYYYYKrK",
    "KRKWWPWWKYyYYKrK",
    "KRKWWWWWKYYYyKrK",
    "KRKWWWWWKKKKKKrK",
    "KRKKKKKKKMMmMKrK",
    "KRKOOoOOKMmMMKrK",
    "KRKOOOoOKMMMmKrK",
    "KRKKKKKKKKKKKKrK",
    "KrrrrrrrrrrrrrrK",
    "KKKKKKKKKKKKKKKK"],
  mascot:[
    ".......KK.......",
    "......KcCK......",
    "....KKCCCCKK....",
    "...KCCCCCCCCK...",
    "..KCCCCCCCCCCK..",
    ".KCCCCCCCCCCCcK.",
    ".KCCCKCCCCKCCcK.",
    "KCCCCKCCCCKCCCcK",
    "KCPPCCCKKCCCPPcK",
    "KCCCCCCCCCCCCccK",
    "KcCCCCCCCCCCcccK",
    ".KccccccccccccK.",
    "..KKKKKKKKKKKK.."]
};

function sprite(name, size){
  const g = SPRITES[name] || SPRITES.onigiri, h = g.length, w = g[0].length;
  let r = "";
  g.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== ".") r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[c]}"/>`;
  }));
  return `<svg class="sprite" viewBox="0 0 ${w} ${h}" width="${w*size}" height="${h*size}" aria-hidden="true">${r}</svg>`;
}
