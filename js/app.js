// ============================================================
// $ourceat — app.js
// ============================================================
import { loadComments, saveComment, saveReply, updateLike, loadTrends } from './firebase.js';

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbzZ8jtv4i6NbivCVID5XmKgKw_gIcWibalBYguB6IMKFt0CUZmvff5SwhXnUU0Qld8v/exec';

const SHOPS = [
  { key:'amazon',   name:'Amazon',   tag:'Ships nationwide' },
  { key:'weee',     name:'Weee!',    tag:'Asian grocery'    },
  { key:'hmart',    name:'H-Mart',   tag:'Korean specialty' },
  { key:'wooltari', name:'Wooltari', tag:'K-Food direct'    },
  { key:'yamibuy',  name:'Yami',     tag:'Asian online'     },
];

let currentSort = 'new';
const COMMENTS_ENABLED = false;

const NICKNAME_KEY = 'sourceat_nickname';
function getNickname() { return localStorage.getItem(NICKNAME_KEY) || ''; }
function setNickname(n) { if (n.trim()) localStorage.setItem(NICKNAME_KEY, n.trim()); }

let TRENDS = [
  {
    trend_id:'buldak', title:'Buldak Challenge',
    tag:'🔥 Hot', tag_style:'t-hot',
    channels:['TikTok','YouTube','Instagram','Reddit'],
    desc:"Samyang's fire noodles went from a Korean convenience store staple to a global phenomenon. The challenge format spread across every major platform simultaneously.",
    video:{ label:'Watch: Fire Noodle Challenge', url:'https://www.youtube.com/results?search_query=buldak+fire+noodle+challenge' },
    products:[
      { product_id:'b1', name:'Buldak Ramen Original (5pk)', brand:'Samyang', desc:'The one that started it all. Intensely spicy stir-fried noodles with a savory chicken sauce.', img_url:'https://img08.weeecdn.net/item/image/320/664/33D51C5F44804584.jpeg!c864x0_q80.auto', img_fallbacks:['https://img08.weeecdn.net/product/image/246/100/1D0F89AC3A3D7FCA.png!c864x0_q80.auto'], shops:{ hmart:{price:6.99,url:'https://www.hmart.com/hot-chicken-flavor-ramen-4-94oz-140g--5-packs-1/p'}, weee:{price:7.49,url:'https://www.sayweee.com/en/product/Samyang-Buldak-Ramen--Hot-Chicken-Flavor--2x-Spicy-5pk/59341'}, wooltari:{price:7.29,url:'https://www.wooltariusa.com'}, amazon:{price:9.99,url:'https://www.amazon.com/s?k=samyang+buldak+hot+chicken+ramen+original+5+pack'}, yamibuy:{price:8.49,url:'https://www.yami.com/search?q=samyang+buldak+original'} } },
      { product_id:'b2', name:'Buldak Carbonara (5pk)', brand:'Samyang', desc:'Creamy carbonara meets Korean fire. The most popular entry point for first-timers.', img_url:'https://img08.weeecdn.net/product/image/163/812/6482C3FEE019CAFA.png!c864x0_q80.auto', img_fallbacks:['https://img08.weeecdn.net/product/image/988/344/761523A9A8E8CBA2.png!c864x0_q80.auto'], shops:{ hmart:{price:8.99,url:'https://www.hmart.com/carbo-hot-chicken-flavor-ramen-4-5oz-130g--5-packs-1/p'}, weee:{price:8.99,url:'https://www.sayweee.com/en/product/Samyang-Buldak-Ramen-Carbonara-Hot-Chicken-Flavor/71188'}, wooltari:{price:null,url:null}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=samyang+buldak+carbonara+ramen+5+pack'}, yamibuy:{price:9.99,url:'https://www.yami.com/search?q=samyang+buldak+carbonara'} } },
      { product_id:'b3', name:'Buldak 2x Spicy (5pk)', brand:'Samyang', desc:'Double the capsaicin. A true test of spice tolerance.', img_url:'https://img08.weeecdn.net/product/image/246/100/1D0F89AC3A3D7FCA.png!c864x0_q80.auto', shops:{ hmart:{price:8.99,url:'https://www.hmart.com/extra-hot-chicken-flavor-ramen-4-94oz-140g--5-packs-1/p'}, weee:{price:9.99,url:'https://www.sayweee.com/en/product/Samyang-Buldak-Ramen--Hot-Chicken-Flavor--2x-Spicy-5pk/59341'}, wooltari:{price:null,url:null}, amazon:{price:11.99,url:'https://www.amazon.com/s?k=samyang+buldak+2x+spicy+ramen+5+pack'}, yamibuy:{price:9.49,url:'https://www.yami.com/search?q=samyang+buldak+2x+spicy'} } },
      { product_id:'b4', name:'Buldak Quattro Cheese (5pk)', brand:'Samyang', desc:'Four cheese blend tames the heat. Popular with cheese lovers.', img_url:'https://img08.weeecdn.net/product/image/238/941/16818529242176F8.png!c864x0_q80.auto', shops:{ hmart:{price:7.99,url:'https://www.hmart.com/quattro-cheese-hot-chicken-flavor-ramen-5-11oz-145g--5-packs-1/p'}, weee:{price:9.49,url:'https://www.sayweee.com'}, wooltari:{price:8.49,url:'https://www.wooltariusa.com'}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=samyang+buldak+quattro+cheese+5+pack'}, yamibuy:{price:9.99,url:'https://www.yami.com/search?q=samyang+buldak+quattro+cheese'} } },
      { product_id:'b5', name:'Buldak Habanero Lime', brand:'Samyang', desc:'Habanero heat with a fresh citrus twist. Limited availability.', img_url:'https://img08.weeecdn.net/product/image/766/920/72B0A05A5DCB4FFD.png!c864x0_q80.auto', shops:{ hmart:{price:1.49,url:'https://www.hmart.com/spicy-chicken-flavor-ramen-habanero-lime-big-bowl-3-7oz-105g--1/p'}, weee:{price:null,url:null}, wooltari:{price:null,url:null}, amazon:{price:2.49,url:'https://www.amazon.com/s?k=samyang+buldak+habanero+lime+ramen'}, yamibuy:{price:null,url:null} } },
      { product_id:'b6', name:'Buldak Jjajang (5pk)', brand:'Samyang', desc:'Black bean sauce meets Buldak spice. A Korean-Chinese fusion flavor that surprised everyone.', img_url:'https://img08.weeecdn.net/item/image/305/855/47549719BF977F5C.jpg!c864x0_q80.auto', shops:{ hmart:{price:8.99,url:'https://www.hmart.com'}, weee:{price:9.49,url:'https://www.sayweee.com'}, wooltari:{price:8.99,url:'https://www.wooltariusa.com'}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=samyang+buldak+jjajang'}, yamibuy:{price:9.49,url:'https://www.yami.com/search?q=samyang+buldak+jjajang'} } },
      { product_id:'b7', name:'Buldak Curry (5pk)', brand:'Samyang', desc:'Yellow curry spice profile with the signature Buldak heat. A fan-favorite limited flavor.', img_url:'https://img08.weeecdn.net/product/image/988/344/761523A9A8E8CBA2.png!c864x0_q80.auto', shops:{ hmart:{price:8.99,url:'https://www.hmart.com'}, weee:{price:9.49,url:'https://www.sayweee.com'}, wooltari:{price:null,url:null}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=samyang+buldak+curry+ramen'}, yamibuy:{price:9.49,url:'https://www.yami.com/search?q=samyang+buldak+curry'} } },
      { product_id:'b8', name:'Buldak Kimchi (5pk)', brand:'Samyang', desc:'Kimchi tang layered with fire chicken heat. Tangy, funky, and spicy all at once.', img_url:'https://img08.weeecdn.net/product/image/273/659/3E9D8AD78C3A1C82.png!c864x0_q80.auto', shops:{ hmart:{price:8.99,url:'https://www.hmart.com'}, weee:{price:9.49,url:'https://www.sayweee.com'}, wooltari:{price:8.99,url:'https://www.wooltariusa.com'}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=samyang+buldak+kimchi+ramen'}, yamibuy:{price:9.49,url:'https://www.yami.com/search?q=samyang+buldak+kimchi'} } },
      { product_id:'b9', name:'Buldak Cheese Hot Chicken (5pk)', brand:'Samyang', desc:'Single cheese flavor — a milder, creamier take on the classic fire noodles. Great for cheese lovers who want less heat.', img_url:'https://img08.weeecdn.net/product/image/238/941/16818529242176F8.png!c864x0_q80.auto', img_fallbacks:['https://img08.weeecdn.net/description/image/577/479/2AB48C7FFA2CC1C2.png!c864x0_q80.auto'], shops:{ hmart:{price:8.99,url:'https://www.hmart.com'}, weee:{price:8.99,url:'https://www.sayweee.com/en/product/Samyang-Buldak-Ramen-Cheese-Hot-Chicken-Flavor/96921'}, wooltari:{price:null,url:null}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=samyang+buldak+cheese+hot+chicken+ramen'}, yamibuy:{price:9.49,url:'https://www.yami.com/search?q=samyang+buldak+cheese'} } },
      { product_id:'b10', name:'Buldak Cup Noodle', brand:'Samyang', desc:'Single-serve cup version — perfect for trying Buldak for the first time without committing to a 5-pack.', img_url:'https://img08.weeecdn.net/item/image/421/583/6EE19352EB8E6AC5.png!c864x0_q80.auto', shops:{ hmart:{price:1.99,url:'https://www.hmart.com'}, weee:{price:2.29,url:'https://www.sayweee.com'}, wooltari:{price:1.99,url:'https://www.wooltariusa.com'}, amazon:{price:3.49,url:'https://www.amazon.com/s?k=samyang+buldak+cup+noodle'}, yamibuy:{price:2.49,url:'https://www.yami.com/search?q=samyang+buldak+cup'} } },
    ]
  },
  {
    trend_id:'kimbap', title:'Kimbap Moment',
    tag:'📈 Rising', tag_style:'t-rising',
    channels:['Netflix','NYT Food','Instagram','K-Drama'],
    desc:"After years of being overlooked, kimbap is having its moment. Featured in major US food media and K-dramas alike.",
    video:{ label:'Watch: Kimbap — How to make & eat', url:'https://www.youtube.com/results?search_query=kimbap+how+to+make+korean' },
    products:[
      { product_id:'k1', name:'Tuna Mayo Kimbap', brand:'Pulmuone', desc:'Classic tuna and mayo filling. The most approachable kimbap for non-Korean shoppers.', img_url:'https://img08.weeecdn.net/product/image/036/535/7FDBACE73077313C.png!c864x0_q80.auto', img_fallbacks:['https://img08.weeecdn.net/product/image/531/389/383668C434AC141B.png!c864x0_q80.auto'], shops:{ hmart:{price:4.99,url:'https://www.hmart.com/tuna-mayo-kimbap-8-46oz-240g-/p'}, weee:{price:5.49,url:'https://www.sayweee.com'}, wooltari:{price:5.29,url:'https://www.wooltariusa.com'}, amazon:{price:6.99,url:'https://www.amazon.com/s?k=pulmuone+tuna+mayo+kimbap'}, yamibuy:{price:5.99,url:'https://www.yami.com/search?q=pulmuone+tuna+kimbap'} } },
      { product_id:'k2', name:'Vegetable Kimbap', brand:'Pulmuone', desc:'Spinach, pickled radish, burdock and carrots. Vegan-friendly.', img_url:'https://img08.weeecdn.net/product/image/445/622/3E3218EE9369A743.png!c864x0_q80.auto', shops:{ hmart:{price:4.99,url:'https://www.hmart.com/vegetable-kimbap-8-11oz-230g-/p'}, weee:{price:null,url:null}, wooltari:{price:4.79,url:'https://www.wooltariusa.com'}, amazon:{price:6.49,url:'https://www.amazon.com/s?k=pulmuone+vegetable+kimbap'}, yamibuy:{price:5.49,url:'https://www.yami.com/search?q=pulmuone+vegetable+kimbap'} } },
      { product_id:'k3', name:'Japchae Vegan Kimbap', brand:'Pulmuone', desc:'Glass noodles and vegetables wrapped in seaweed rice.', img_url:'https://img08.weeecdn.net/item/image/565/358/5DCA37916B1EF3A3.jpeg!c864x0_q80.auto', shops:{ hmart:{price:4.99,url:'https://www.hmart.com/japchae-vegan-kimbap-7-76oz-220g-/p'}, weee:{price:5.49,url:'https://www.sayweee.com'}, wooltari:{price:null,url:null}, amazon:{price:6.49,url:'https://www.amazon.com/s?k=pulmuone+japchae+kimbap'}, yamibuy:{price:5.49,url:'https://www.yami.com/search?q=pulmuone+japchae+kimbap'} } },
      { product_id:'k4', name:'Triangle Kimbap Bibimbap', brand:'CJ', desc:'Convenience store-style triangle kimbap for younger shoppers.', img_url:'https://img08.weeecdn.net/product/image/465/195/31ECA26AD47E8E5D.png!c864x0_q80.auto', shops:{ hmart:{price:null,url:null}, weee:{price:3.49,url:'https://www.sayweee.com'}, wooltari:{price:3.29,url:'https://www.wooltariusa.com'}, amazon:{price:4.99,url:'https://www.amazon.com/s?k=CJ+triangle+kimbap+bibimbap'}, yamibuy:{price:3.99,url:'https://www.yami.com/search?q=CJ+triangle+kimbap'} } },
      { product_id:'k5', name:'Beef Bulgogi Kimbap', brand:'Pulmuone', desc:'Marinated beef bulgogi filling — richer and more savory than tuna. A step up for kimbap fans.', img_url:'https://img08.weeecdn.net/item/image/269/506/13373C9ECBF15BDE.png.jpeg!c864x0_q80.auto', shops:{ hmart:{price:5.49,url:'https://www.hmart.com'}, weee:{price:5.99,url:'https://www.sayweee.com'}, wooltari:{price:5.49,url:'https://www.wooltariusa.com'}, amazon:{price:7.49,url:'https://www.amazon.com/s?k=pulmuone+beef+bulgogi+kimbap'}, yamibuy:{price:5.99,url:'https://www.yami.com/search?q=pulmuone+beef+bulgogi+kimbap'} } },
      { product_id:'k6', name:'Kimchi Kimbap', brand:'Pulmuone', desc:'Tangy kimchi filling with a slight crunch. Bold flavor — best for kimchi lovers.', img_url:'https://img08.weeecdn.net/product/image/071/383/1DA68CDEC816E4A5.png!c864x0_q80.auto', shops:{ hmart:{price:4.99,url:'https://www.hmart.com'}, weee:{price:5.49,url:'https://www.sayweee.com'}, wooltari:{price:4.99,url:'https://www.wooltariusa.com'}, amazon:{price:6.99,url:'https://www.amazon.com/s?k=pulmuone+kimchi+kimbap'}, yamibuy:{price:5.49,url:'https://www.yami.com/search?q=pulmuone+kimchi+kimbap'} } },
      { product_id:'k7', name:'Triangle Kimbap Spicy Tuna', brand:'Dongwon', desc:'Spicy tuna filling in the iconic Korean triangle format. A convenience store classic.', img_url:'https://img08.weeecdn.net/product/image/778/243/43E108EC214067BA.png!c864x0_q80.auto', shops:{ hmart:{price:2.49,url:'https://www.hmart.com'}, weee:{price:2.99,url:'https://www.sayweee.com'}, wooltari:{price:2.79,url:'https://www.wooltariusa.com'}, amazon:{price:null,url:null}, yamibuy:{price:2.99,url:'https://www.yami.com/search?q=dongwon+triangle+kimbap+spicy+tuna'} } },
      { product_id:'k8', name:'Gimbap Tuna Rice Roll', brand:'Jayone', desc:'Korean rice roll with tuna filling — shelf-stable and ready to eat. Compact size, big flavor.', img_url:'https://img08.weeecdn.net/product/image/531/389/383668C434AC141B.png!c864x0_q80.auto', shops:{ hmart:{price:4.99,url:'https://www.hmart.com'}, weee:{price:5.49,url:'https://www.sayweee.com/en/product/Jayone-Gimbap-Korean-Rice-Roll-with-Tuna/104665'}, wooltari:{price:null,url:null}, amazon:{price:6.99,url:'https://www.amazon.com/s?k=jayone+gimbap+tuna+rice+roll'}, yamibuy:{price:5.99,url:'https://www.yami.com/search?q=jayone+gimbap+tuna'} } },
      { product_id:'k9', name:'Vegan Bulgogi Kimbap (Frozen)', brand:'Vegreen', desc:'Plant-based bulgogi kimbap — full-length frozen roll. Hearty, satisfying, and vegan-friendly.', img_url:'https://img08.weeecdn.net/item/image/106/598/3C834E3FE082A29.webp!c864x0_q80.auto', shops:{ hmart:{price:null,url:null}, weee:{price:7.99,url:'https://www.sayweee.com/en/product/VEGAN-Bulgogi-Kimbap-Frozen-1-roll-220-g/2081541'}, wooltari:{price:null,url:null}, amazon:{price:null,url:null}, yamibuy:{price:null,url:null} } },
      { product_id:'k10', name:'Classic Kimbap Roll', brand:'Wang Korea', desc:'Traditional kimbap with egg, fish cake, pickled radish, and spinach. The original formula.', img_url:'https://img08.weeecdn.net/product/image/675/737/B3EAAA91CF593CC.png!c864x0_q80.auto', shops:{ hmart:{price:4.49,url:'https://www.hmart.com'}, weee:{price:null,url:null}, wooltari:{price:4.49,url:'https://www.wooltariusa.com'}, amazon:{price:6.49,url:'https://www.amazon.com/s?k=wang+korea+classic+kimbap'}, yamibuy:{price:4.99,url:'https://www.yami.com/search?q=wang+korea+kimbap'} } },
    ]
  },
  {
    trend_id:'streetfood', title:'Street Food at Home',
    tag:'🚀 Viral', tag_style:'t-viral',
    channels:['YouTube','TikTok','Instagram Reels'],
    desc:"Korean street food is coming home — tteokbokki kits and frozen mandu bringing the pojangmacha experience to American kitchens.",
    video:{ label:'Watch: Korean Street Food at Home', url:'https://www.youtube.com/results?search_query=korean+street+food+tteokbokki+mandu+recipe' },
    products:[
      { product_id:'t1', name:'Tteokbokki Kit Original', brand:'Ottogi', desc:'The definitive home tteokbokki kit. Ready in 5 minutes.', img_url:'https://img08.weeecdn.net/product/image/306/934/7DE375FE2416E992.png!c864x0_q80.auto', shops:{ hmart:{price:3.49,url:'https://www.hmart.com'}, weee:{price:3.79,url:'https://www.sayweee.com'}, wooltari:{price:3.59,url:'https://www.wooltariusa.com'}, amazon:{price:4.99,url:'https://www.amazon.com/s?k=ottogi+tteokbokki+kit'}, yamibuy:{price:3.99,url:'https://www.yami.com/search?q=ottogi+tteokbokki'} } },
      { product_id:'t2', name:'Carbonara Tteokbokki', brand:'Samyang', desc:'Rose sauce meets chewy rice cakes. Creamy and mildly spicy.', img_url:'https://img08.weeecdn.net/product/image/349/331/5E1A19F0FE0CD05A.png!c864x0_q80.auto', img_fallbacks:['https://img08.weeecdn.net/product/image/638/139/2CF3F62717F42AEC.png!c864x0_q80.auto'], shops:{ hmart:{price:3.99,url:'https://www.hmart.com'}, weee:{price:null,url:null}, wooltari:{price:3.89,url:'https://www.wooltariusa.com'}, amazon:{price:5.99,url:'https://www.amazon.com/s?k=samyang+carbonara+tteokbokki'}, yamibuy:{price:4.49,url:'https://www.yami.com/search?q=samyang+carbonara+tteokbokki'} } },
      { product_id:'t3', name:'Frozen Mandu Kimchi', brand:'Pulmuone', desc:'Kimchi-filled dumplings — pan-fry for crispy exterior.', img_url:'https://img08.weeecdn.net/product/image/218/490/459233BF878C22FF.png!c864x0_q80.auto', shops:{ hmart:{price:6.49,url:'https://www.hmart.com'}, weee:{price:6.99,url:'https://www.sayweee.com'}, wooltari:{price:null,url:null}, amazon:{price:9.99,url:'https://www.amazon.com/s?k=pulmuone+frozen+mandu+kimchi'}, yamibuy:{price:7.49,url:'https://www.yami.com/search?q=pulmuone+kimchi+mandu'} } },
      { product_id:'t4', name:'Bibigo Mandu Pork & Veggie', brand:'CJ Bibigo', desc:"CJ Bibigo's best-selling dumpling. Now at mainstream US retailers.", img_url:'https://img08.weeecdn.net/product/image/095/137/60D530637BAEE26D.png!c864x0_q80.auto', shops:{ hmart:{price:7.99,url:'https://www.hmart.com'}, weee:{price:7.49,url:'https://www.sayweee.com'}, wooltari:{price:7.99,url:'https://www.wooltariusa.com'}, amazon:{price:12.99,url:'https://www.amazon.com/s?k=bibigo+mandu+pork+vegetable+dumplings'}, yamibuy:{price:8.49,url:'https://www.yami.com/search?q=bibigo+mandu+pork+vegetable'} } },
      { product_id:'t5', name:'Shin Ramyun Black', brand:'Nongshim', desc:'Premium Shin Ramen. Rich beef bone broth, thicker noodles.', img_url:'https://img08.weeecdn.net/product/image/228/050/7717133151964C86.png!c864x0_q80.auto', shops:{ hmart:{price:1.99,url:'https://www.hmart.com'}, weee:{price:2.19,url:'https://www.sayweee.com'}, wooltari:{price:2.09,url:'https://www.wooltariusa.com'}, amazon:{price:2.49,url:'https://www.amazon.com/s?k=nongshim+shin+ramyun+black'}, yamibuy:{price:2.29,url:'https://www.yami.com/search?q=nongshim+shin+ramyun+black'} } },
      { product_id:'t6', name:'Tteokbokki Rose Sauce', brand:'Haepyo', desc:'Creamy rose sauce tteokbokki — a milder, creamier alternative to the spicy original.', img_url:'https://img08.weeecdn.net/product/image/638/139/2CF3F62717F42AEC.png!c864x0_q80.auto', shops:{ hmart:{price:3.99,url:'https://www.hmart.com'}, weee:{price:4.29,url:'https://www.sayweee.com'}, wooltari:{price:3.99,url:'https://www.wooltariusa.com'}, amazon:{price:5.49,url:'https://www.amazon.com/s?k=haepyo+tteokbokki+rose+sauce'}, yamibuy:{price:4.49,url:'https://www.yami.com/search?q=haepyo+tteokbokki+rose'} } },
      { product_id:'t7', name:'Bibigo Mini Steamed Dumplings', brand:'CJ Bibigo', desc:'Smaller format, easier to cook. Steam or microwave in minutes — same great Bibigo flavor.', img_url:'https://img08.weeecdn.net/product/image/746/707/51048E70B43C2FA.png!c864x0_q80.auto', shops:{ hmart:{price:6.99,url:'https://www.hmart.com'}, weee:{price:6.99,url:'https://www.sayweee.com'}, wooltari:{price:null,url:null}, amazon:{price:9.99,url:'https://www.amazon.com/s?k=bibigo+mini+steamed+dumplings'}, yamibuy:{price:7.49,url:'https://www.yami.com/search?q=bibigo+mini+steamed+dumplings'} } },
      { product_id:'t8', name:'Chapagetti Black Bean Ramen', brand:'Nongshim', desc:'Korean-style jjajangmyeon (black bean noodles). Savory, rich, and deeply umami — no spice.', img_url:'https://img08.weeecdn.net/product/image/476/232/690D112723E60572.png!c864x0_q80.auto', shops:{ hmart:{price:1.49,url:'https://www.hmart.com'}, weee:{price:1.69,url:'https://www.sayweee.com'}, wooltari:{price:1.59,url:'https://www.wooltariusa.com'}, amazon:{price:1.99,url:'https://www.amazon.com/s?k=nongshim+chapagetti+black+bean+noodles'}, yamibuy:{price:1.79,url:'https://www.yami.com/search?q=nongshim+chapagetti'} } },
      { product_id:'t9', name:'Ottogi Cheese Ramyun', brand:'Ottogi', desc:'Mild, cheesy instant ramen — the most beginner-friendly Korean ramen. Great gateway for spice-averse eaters.', img_url:'https://img08.weeecdn.net/product/image/642/508/23D4E86785C45208.png!c864x0_q80.auto', shops:{ hmart:{price:1.49,url:'https://www.hmart.com'}, weee:{price:1.79,url:'https://www.sayweee.com'}, wooltari:{price:1.59,url:'https://www.wooltariusa.com'}, amazon:{price:2.49,url:'https://www.amazon.com/s?k=ottogi+cheese+ramyun'}, yamibuy:{price:1.99,url:'https://www.yami.com/search?q=ottogi+cheese+ramyun'} } },
      { product_id:'t10', name:'Jongga Kimchi (1 lb)', brand:'Jongga', desc:"South Korea's #1 kimchi brand. Essential side dish for tteokbokki, mandu, or ramen.", img_url:'https://img08.weeecdn.net/product/image/466/081/39713897B4215FAF.png!c864x0_q80.auto', shops:{ hmart:{price:5.99,url:'https://www.hmart.com'}, weee:{price:6.49,url:'https://www.sayweee.com'}, wooltari:{price:6.29,url:'https://www.wooltariusa.com'}, amazon:{price:8.99,url:'https://www.amazon.com/s?k=jongga+kimchi+1lb'}, yamibuy:{price:6.99,url:'https://www.yami.com/search?q=jongga+kimchi'} } },
    ]
  },
];

const SEED_COMMENTS = {
  b1:[
    { author:'Alex M.',  time:'2 days ago', text:"H-Mart price is hard to beat. Pro tip: leave about 8 spoons of water before mixing the sauce.", likes:14 },
    { author:'Jenny K.', time:'1 day ago',  text:"Weee delivered in 2 days. Slightly pricier but convenient if you're not near an H-Mart.", likes:7 },
  ],
  k1:[{ author:'Ryan T.', time:'3 days ago', text:"Game changer for lunch. Pairs perfectly with kimchi on the side.", likes:11 }],
  t1:[
    { author:'Mia L.', time:'5 days ago', text:"Add a slice of processed cheese and a fish cake. That's how they do it on the street.", likes:22 },
    { author:'Sam B.', time:'4 days ago', text:"Wooltari had a bundle deal with the carbonara version last month.", likes:6 },
  ],
  t4:[{ author:'Chris W.', time:'1 week ago', text:"Found these at Costco too — massive bag, great value.", likes:18 }],
};

const commentStore = {};
function initCommentStore() {
  TRENDS.forEach(tr => tr.products.forEach(p => {
    if (!commentStore[p.product_id]) {
      commentStore[p.product_id] = (SEED_COMMENTS[p.product_id] || []).map(c => ({ ...c, id: Math.random() }));
    }
  }));
}

// ── 데이터 로드 (Firestore → 하드코딩) ───────────────────
async function loadFromSheets() {
  const container = document.getElementById('trends-container');
  container.innerHTML = '<div style="text-align:center;padding:60px 32px;color:#9A9A94;font-size:14px">Loading products...</div>';

  // 1순위: Firestore (Python 스크립트로 매일 자동 업데이트)
  try {
    const firestoreTrends = await loadTrends();
    if (firestoreTrends && firestoreTrends.length > 0) {
      TRENDS = firestoreTrends;
      console.log('✅ Firestore 데이터 로드:', TRENDS.length, '트렌드');
      container.innerHTML = '';
      initCommentStore();
      renderTrends();
      buildHeroStrip();
      injectJsonLd();
      return;
    }
  } catch(e) {
    console.warn('Firestore 로드 실패, 하드코딩 데이터 사용:', e);
  }

  // 2순위: 하드코딩 데이터
  console.log('📦 하드코딩 데이터 사용');
  container.innerHTML = '';
  initCommentStore();
  renderTrends();
  buildHeroStrip();
  injectJsonLd();
}

// ── 히어로 스크롤 스트립 ──────────────────────────────────
function buildHeroStrip() {
  const track = document.getElementById('hero-scroll-track');
  if (!track) return;

  // 트렌드 순서대로 그룹핑 (hot → rising → viral)
  const groups = TRENDS.map(tr =>
    tr.products.map(p => ({ img: p.img_url, name: p.name })).filter(p => p.img)
  );

  if (groups.every(g => g.length === 0)) return;

  // 라운드로빈 인터리브: groups[0][0], groups[1][0], groups[2][0], groups[0][1], ...
  const interleaved = [];
  const maxLen = Math.max(...groups.map(g => g.length));
  for (let i = 0; i < maxLen; i++) {
    groups.forEach(g => { if (g[i]) interleaved.push(g[i]); });
  }

  // seamless loop을 위해 두 배로 복제
  const items = [...interleaved, ...interleaved];
  track.innerHTML = items.map(({ img, name }) => `
    <div class="hero-scroll-item">
      <img src="${img}" alt="${name}" loading="lazy" onerror="this.closest('.hero-scroll-item').remove()"/>
    </div>
  `).join('');
}

// ── 헬퍼 ─────────────────────────────────────────────────
function availCount(shops) { return SHOPS.filter(sh => shops[sh.key] && shops[sh.key].url).length; }

// ── 렌더링 ────────────────────────────────────────────────
function renderTrends() {
  const container = document.getElementById('trends-container');
  container.innerHTML = '';

  TRENDS.forEach((tr, ti) => {
    const section = document.createElement('section');
    section.className = 'trend-section';
    const channelPills = (tr.channels || []).map(ch => {
      const url = tr.social_links?.[ch];
      return url
        ? `<a class="ch-badge ch-link" href="${url}" target="_blank" rel="noopener">${ch} ↗</a>`
        : `<span class="ch-badge">${ch}</span>`;
    }).join('');

    section.innerHTML = `
      <div class="trend-header">
        <div class="trend-meta">
          <span class="trend-tag ${tr.tag_style}">${tr.tag}</span>
          <div class="trend-channels">${channelPills}</div>
        </div>
        <div class="trend-title">${tr.title}</div>
        <div class="trend-desc">${tr.desc}</div>
        <div class="trend-count-row">
          <span class="trend-count">${tr.products.length} products tracked</span>
          ${tr.video ? `<a class="trend-video-link" href="${tr.video.url}" target="_blank" rel="noopener noreferrer">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.5 8.5l-5 3A.5.5 0 016 11V5a.5.5 0 01.5-.44l5 3a.5.5 0 010 .94z"/></svg>
            ${tr.video.label}
          </a>` : ''}
        </div>
      </div>
      <div class="prod-grid" id="grid-${tr.trend_id}"></div>
    `;
    container.appendChild(section);

    const grid = section.querySelector(`#grid-${tr.trend_id}`);
    tr.products.forEach((p, pi) => {
      const ac = availCount(p.shops);

      const card = document.createElement('div');
      card.className = 'card';
      card.style.animationDelay = `${(ti * 0.08) + (pi * 0.06)}s`;
      card.onclick = () => openModal(p.product_id);

      const thumb = document.createElement('div');
      thumb.className = 'card-thumb';
      thumb.style.position = 'relative';
      const avBadge = document.createElement('span');
      avBadge.className = `avail-badge ${ac === SHOPS.length ? 'avail-all' : 'avail-some'}`;
      avBadge.style.cssText = 'position:absolute;top:8px;right:8px;z-index:2';
      avBadge.textContent = `${ac}/${SHOPS.length} stores`;
      thumb.appendChild(avBadge);
      const firstImg = p.img_url || (p.img_fallbacks && p.img_fallbacks[0]);
      if (firstImg) {
        const img = document.createElement('img');
        img.src = firstImg; img.alt = p.name; img.loading = 'lazy';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s';
        const fallbacks = [
          ...(p.img_url ? (p.img_fallbacks || []) : (p.img_fallbacks || []).slice(1)),
        ];
        let fi = 0;
        img.onerror = function() {
          if (fi < fallbacks.length) { this.src = fallbacks[fi++]; return; }
          const fb = document.createElement('div');
          fb.className = 'thumb-fallback';
          fb.textContent = p.brand;
          this.parentNode.replaceChild(fb, this);
        };
        thumb.appendChild(img);
      } else {
        const fb = document.createElement('div');
        fb.className = 'thumb-fallback';
        fb.textContent = p.brand;
        thumb.appendChild(fb);
      }
      card.appendChild(thumb);

      const pillsHTML = SHOPS.map(sh => {
        const on = p.shops[sh.key] && p.shops[sh.key].url;
        return `<span class="shop-pill ${on ? 'on' : ''}">${sh.name}</span>`;
      }).join('');

      const body = document.createElement('div');
      body.innerHTML = `
        <div class="card-body">
          <div class="card-brand">${p.brand}</div>
          <div class="card-name">${p.name}</div>
          <div class="card-desc">${p.desc}</div>
        </div>
        <div class="card-shops-preview">${pillsHTML}</div>
        <div class="card-footer">
          <span class="card-store-count">${ac} store${ac !== 1 ? 's' : ''}</span>
          <span class="card-cta">Find it →</span>
        </div>
      `;
      while (body.firstChild) card.appendChild(body.firstChild);
      grid.appendChild(card);
    });
  });
}

// ── 모달 ─────────────────────────────────────────────────
function findProduct(id) {
  for (const tr of TRENDS) {
    const p = tr.products.find(x => x.product_id === id);
    if (p) return { p, tr };
  }
  return null;
}

function openModal(id) {
  const found = findProduct(id);
  if (!found) return;
  const { p, tr } = found;

  const channelPills = (tr.channels || []).map(ch => {
    const url = tr.social_links?.[ch];
    return url
      ? `<a class="ch-badge ch-link" href="${url}" target="_blank" rel="noopener">${ch} ↗</a>`
      : `<span class="ch-badge">${ch}</span>`;
  }).join('');
  document.getElementById('modal-trend-row').innerHTML = `
    <span class="trend-tag ${tr.tag_style}" style="font-size:10px;padding:2px 8px">${tr.tag}</span>
    <span style="font-size:11px;color:var(--gray-400)">trending via</span>
    ${channelPills}
  `;
  document.getElementById('modal-name').textContent  = p.name;
  document.getElementById('modal-brand').textContent = p.brand;
  document.getElementById('modal-desc').textContent  = p.desc;

  document.getElementById('modal-shops').innerHTML = SHOPS.map(sh => {
    const s = p.shops[sh.key] || {};
    return s.url
      ? `<a class="shop-btn avail" href="${s.url}" target="_blank" rel="noopener noreferrer">
          <span class="shop-btn-name">${sh.name}</span>
          <span class="shop-btn-tag">${sh.tag}</span>
          <span class="shop-btn-cta">Shop on ${sh.name} →</span>
         </a>`
      : `<div class="shop-btn unavail">
          <span class="shop-btn-name">${sh.name}</span>
          <span class="shop-btn-na">Not carried</span>
         </div>`;
  }).join('');

  // 소셜 공유
  const shareUrl   = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(`${p.name} — Find it in the US on $ourceat`);
  document.getElementById('modal-share').innerHTML = `
    <button class="share-btn" onclick="copyLink()" id="copy-btn">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="1" width="10" height="10" rx="2"/><path d="M1 5h4v10h10V9"/></svg>
      Copy link
    </button>
    <a class="share-btn" href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" rel="noopener">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.6 1h2.4l-5.2 5.9L16 15h-4.8l-3.8-4.9L2.9 15H.5l5.6-6.3L0 1h4.9l3.4 4.4L12.6 1zm-.8 12.5h1.3L4.3 2.3H2.9l8.9 11.2z"/></svg>
      X (Twitter)
    </a>
    <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8a8 8 0 10-9.25 7.9V10.3H4.7V8h2.05V6.22c0-2 1.2-3.12 3-3.12.9 0 1.83.16 1.83.16v2h-1.03c-1.01 0-1.33.63-1.33 1.27V8h2.26l-.36 2.3H9.22V15.9A8 8 0 0016 8z"/></svg>
      Facebook
    </a>
    <a class="share-btn" href="https://www.reddit.com/submit?url=${shareUrl}&title=${shareTitle}" target="_blank" rel="noopener">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-5.5-1.5a1 1 0 00-1 1c0 .27.1.5.27.68-.7.37-1.64.6-2.77.6s-2.06-.23-2.77-.6A1 1 0 103 9a2.5 2.5 0 001.5 2.28c0 .06-.01.11-.01.17C4.5 12.9 6.07 14 8 14s3.5-1.1 3.5-2.55c0-.06 0-.11-.01-.17A2.5 2.5 0 0013 9a1 1 0 00-2.5-1.5zM6.5 9.5a.75.75 0 110-1.5.75.75 0 010 1.5zm3 0a.75.75 0 110-1.5.75.75 0 010 1.5zm-3.5 2c.55.35 1.25.55 2 .55s1.45-.2 2-.55c-.1.65-.97 1.05-2 1.05s-1.9-.4-2-1.05z"/></svg>
      Reddit
    </a>
  `;

  currentSort = 'new';

  // 댓글 입력 폼 활성/비활성
  const commentForm = document.getElementById('comment-form');
  if (commentForm) commentForm.style.display = COMMENTS_ENABLED ? '' : 'none';
  const disabledNotice = document.getElementById('comments-disabled-notice');
  if (disabledNotice) disabledNotice.style.display = COMMENTS_ENABLED ? 'none' : '';

  const savedNick = getNickname();
  const nameInput = document.getElementById('comment-name');
  const avatarEl  = document.getElementById('comment-avatar');
  nameInput.value = savedNick;
  avatarEl.textContent = savedNick ? initials(savedNick) : 'YOU';
  nameInput.oninput = function() {
    setNickname(this.value);
    avatarEl.textContent = this.value.trim() ? initials(this.value.trim()) : 'YOU';
  };

  renderComments(id);
  document.getElementById('comment-btn').onclick = () => postComment(id);
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closeModal(e) { if (e.target === document.getElementById('overlay')) closeOverlay(); }

async function renderComments(id) {
  const list = document.getElementById('comments-list');
  list.innerHTML = '<div class="no-comments">Loading...</div>';

  const firebaseComments = await loadComments(id);
  const localComments = commentStore[id] || [];
  const all = [...firebaseComments, ...localComments];

  const topLevel = all.filter(c => !c.parentId);
  const replyMap = {};
  all.filter(c => c.parentId).forEach(r => {
    const key = String(r.parentId);
    if (!replyMap[key]) replyMap[key] = [];
    replyMap[key].push(r);
  });

  if (!topLevel.length) {
    list.innerHTML = '<div class="no-comments">Be the first to share your experience with this product.</div>';
    return;
  }

  const sorted = currentSort === 'top'
    ? [...topLevel].sort((a, b) => (b.likes || 0) - (a.likes || 0))
    : topLevel;

  const totalCount = all.length;
  const sortBar = `
    <div class="comment-sort">
      <span class="comment-count-label">${totalCount} comment${totalCount !== 1 ? 's' : ''}</span>
      <div class="sort-btns">
        <button class="sort-btn ${currentSort === 'top' ? 'active' : ''}" onclick="setSort('${id}','top')">Top</button>
        <button class="sort-btn ${currentSort === 'new' ? 'active' : ''}" onclick="setSort('${id}','new')">New</button>
      </div>
    </div>
  `;

  const threadsHTML = sorted.map(c => {
    const cReplies = replyMap[String(c.id)] || [];
    const repliesHTML = cReplies.length
      ? `<div class="replies-list">${cReplies.map(r => renderReplyItem(r, id)).join('')}</div>`
      : '';
    return `
      <div class="comment-thread" data-id="${c.id}">
        <div class="comment-item">
          <div class="avatar-sm" style="flex-shrink:0">${initials(c.author)}</div>
          <div style="flex:1">
            <div class="comment-meta">
              <span class="comment-author">${c.author}</span>
              <span class="comment-time">${c.time}</span>
            </div>
            <div class="comment-text">${c.text}</div>
            <div class="comment-actions">
              <button class="c-action ${c.userLiked ? 'liked' : ''}" onclick="handleLike('${c.id}','${id}',this)">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="${c.userLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M8 14s-6-4.686-6-8a6 6 0 0112 0c0 3.314-6 8-6 8z"/></svg>
                ${c.likes} helpful
              </button>
              <button class="c-action" onclick="toggleReply('${c.id}','${id}')">Reply</button>
            </div>
          </div>
        </div>
        ${repliesHTML}
      </div>
    `;
  }).join('');

  list.innerHTML = sortBar + threadsHTML;
}

function renderReplyItem(r, productId) {
  return `
    <div class="reply-item">
      <div class="avatar-sm reply-avatar">${initials(r.author)}</div>
      <div style="flex:1">
        <div class="comment-meta">
          <span class="comment-author">${r.author}</span>
          <span class="comment-time">${r.time}</span>
        </div>
        <div class="comment-text" style="font-size:12px">${r.text}</div>
        <div class="comment-actions">
          <button class="c-action ${r.userLiked ? 'liked' : ''}" onclick="handleLike('${r.id}','${productId}',this)">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="${r.userLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M8 14s-6-4.686-6-8a6 6 0 0112 0c0 3.314-6 8-6 8z"/></svg>
            ${r.likes} helpful
          </button>
        </div>
      </div>
    </div>
  `;
}

function initials(author) {
  return (author || 'AN').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function toggleReply(commentId, productId) {
  const thread = document.querySelector(`.comment-thread[data-id="${commentId}"]`);
  if (!thread) return;
  const existing = thread.querySelector('.reply-input-container');
  if (existing) { existing.remove(); return; }

  const nick = getNickname();
  const container = document.createElement('div');
  container.className = 'reply-input-container';
  container.innerHTML = `
    <div class="reply-input-row">
      <div class="avatar-sm reply-avatar">${nick ? initials(nick) : 'YOU'}</div>
      <textarea class="comment-textarea" style="min-height:52px;font-size:12px" placeholder="Write a reply..."></textarea>
    </div>
    <div class="reply-actions">
      <button class="comment-submit" style="font-size:10px;padding:5px 12px" onclick="submitReply('${commentId}','${productId}',this)">Reply</button>
      <button class="sort-btn" onclick="this.closest('.reply-input-container').remove()">Cancel</button>
    </div>
  `;
  thread.querySelector('.comment-item').after(container);
  container.querySelector('textarea').focus();
}

async function submitReply(parentId, productId, btn) {
  const container = btn.closest('.reply-input-container');
  const text = container.querySelector('textarea').value.trim();
  if (!text) return;

  btn.textContent = 'Posting...';
  btn.disabled = true;

  const author = getNickname() || 'Anonymous';
  const docId = await saveReply(productId, parentId, author, text);
  if (!docId) {
    if (!commentStore[productId]) commentStore[productId] = [];
    commentStore[productId].unshift({
      id: String(Math.random()), author: 'Anonymous', time: 'Just now',
      text, likes: 0, userLiked: false, parentId,
    });
  }
  await renderComments(productId);
}

function setSort(productId, sort) {
  currentSort = sort;
  renderComments(productId);
}

async function handleLike(cid, pid, btn) {
  const localComment = (commentStore[pid] || []).find(x => String(x.id) === String(cid));
  if (localComment) {
    localComment.userLiked = !localComment.userLiked;
    localComment.likes += localComment.userLiked ? 1 : -1;
  } else {
    const liked  = btn.classList.contains('liked');
    const delta  = liked ? -1 : 1;
    await updateLike(pid, cid, delta);
    btn.classList.toggle('liked');
  }
  renderComments(pid);
}

async function postComment(id) {
  const input  = document.getElementById('comment-input');
  const text   = input.value.trim();
  if (!text) return;

  const btn = document.getElementById('comment-btn');
  btn.textContent = 'Posting...';
  btn.disabled    = true;

  const author = document.getElementById('comment-name')?.value.trim() || 'Anonymous';
  const docId = await saveComment(id, author, text);

  if (docId) {
    input.value = '';
    await renderComments(id);
  } else {
    if (!commentStore[id]) commentStore[id] = [];
    commentStore[id].unshift({ id: String(Math.random()), author, time:'Just now', text, likes:0, userLiked:false, parentId: null });
    input.value = '';
    await renderComments(id);
  }

  btn.textContent = 'Post';
  btn.disabled    = false;
}

// ── 링크 복사 ────────────────────────────────────────────
function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.getElementById('copy-btn');
    if (!btn) return;
    btn.textContent = '✓ Copied!';
    btn.style.background = '#E1F5EE';
    btn.style.color = '#085041';
    btn.style.borderColor = '#5DCAA5';
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="1" width="10" height="10" rx="2"/><path d="M1 5h4v10h10V9"/></svg> Copy link`;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  });
}

// ── K-Food 가이드 모달 ───────────────────────────────────
function openGuide() {
  closeSidebar();
  document.getElementById('guide-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeGuide(e) {
  if (e && e.target !== document.getElementById('guide-overlay')) return;
  document.getElementById('guide-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 사이드바 ─────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 사이드바 이벤트 바인딩 ───────────────────────────────
document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
document.getElementById('open-guide-btn').addEventListener('click', openGuide);

// ── 전역 함수 노출 (HTML onclick에서 사용) ───────────────
window.handleLike    = handleLike;
window.closeOverlay  = closeOverlay;
window.closeModal    = closeModal;
window.postComment   = postComment;
window.copyLink      = copyLink;
window.closeGuide    = closeGuide;
window.closeSidebar  = closeSidebar;
window.toggleReply   = toggleReply;
window.submitReply   = submitReply;
window.setSort       = setSort;

// ── JSON-LD 구조화 데이터 ─────────────────────────────────
function injectJsonLd() {
  const items = [];
  let pos = 1;
  TRENDS.forEach(tr => {
    tr.products.forEach(p => {
      items.push({
        '@type': 'ListItem',
        position: pos++,
        item: {
          '@type': 'Product',
          name: p.name,
          brand: { '@type': 'Brand', name: p.brand },
          description: p.desc,
          ...(p.img_url ? { image: p.img_url } : {}),
          offers: {
            '@type': 'AggregateOffer',
            availability: 'https://schema.org/InStock',
            priceCurrency: 'USD',
          }
        }
      });
    });
  });

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trending Korean Food Products',
    description: 'Korean food products currently going viral on TikTok, YouTube, and Reddit — updated daily.',
    url: 'https://sourceat.vercel.app/',
    itemListElement: items,
  };

  const tag = document.getElementById('ld-json');
  if (tag) tag.textContent = JSON.stringify(ld);
}

// ── 시작 ─────────────────────────────────────────────────
buildHeroStrip();
loadFromSheets();
