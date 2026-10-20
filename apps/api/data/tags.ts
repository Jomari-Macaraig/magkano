// biome-ignore-all format: one Tag per line keeps the vocabulary easy to review.
import type { Unit } from "../src/db/schema";

/**
 * One Tag in the reviewed vocabulary. `g` and `ml` are its Unit Conversions: how many grams
 * (or millilitres) one of that unit holds, inherited by child Tags that don't set their own.
 */
export type TagSeed = {
  slug: string;
  name: string;
  parent?: string;
  aliases: string[];
  g?: Partial<Record<Unit, number>>;
  ml?: Partial<Record<Unit, number>>;
};

// The reviewed Tag vocabulary, edited by hand. Rules (spec: Tags):
// - a Tag is a food only; origin, brand, grade, size and price-list category are never Tags
// - slugs are English kebab-case singular; Filipino names are kept where English has no common name
// - aliases are Tagalog and other English names, unique across all Tags ignoring case; the
//   display name also counts as an alias
// - a child must be usable in place of its parent, so by-products (feet, neck, liver, skin/rind,
//   head, offal, tongue, salmon head) are top-level Tags; pork liver sits under pork offal
// - at most 3 levels deep
// To add a Tag that `tag` proposed, add a line here, then point the Tag Assignment at it.
export const tags: TagSeed[] = [
  // grains and legumes
  { slug: "rice", name: "Rice", aliases: ["bigas", "well milled rice", "regular milled rice", "premium rice", "special rice", "white rice"], g: { cup: 185 } },
  { slug: "glutinous-rice", name: "Glutinous rice", parent: "rice", aliases: ["malagkit", "sticky rice"], g: { cup: 200 } },
  { slug: "basmati-rice", name: "Basmati rice", parent: "rice", aliases: ["basmati"] },
  { slug: "japonica-rice", name: "Japonica rice", parent: "rice", aliases: ["jasponica rice", "japonica"] },
  { slug: "corn", name: "Corn", aliases: ["mais", "corn cob", "sweet corn"], g: { piece: 250, cup: 150 } },
  { slug: "corn-grits", name: "Corn grits", aliases: ["mais na giniling", "binlid na mais"], g: { cup: 160 } },
  { slug: "mung-bean", name: "Mung bean", aliases: ["mung beans", "mungbean", "monggo", "munggo"], g: { cup: 200 } },
  { slug: "green-pea", name: "Green pea", aliases: ["green peas", "gisantes"], g: { cup: 145, can: 400 } },
  { slug: "chickpea", name: "Chickpea", aliases: ["chickpeas", "garbanzos", "garbanzo beans"], g: { cup: 165, can: 400 } },
  { slug: "peanut", name: "Peanut", aliases: ["peanuts", "mani"], g: { cup: 145, tbsp: 9 } },
  { slug: "flour", name: "Flour", aliases: ["all-purpose flour", "harina"], g: { cup: 125, tbsp: 8, tsp: 2.6 } },
  { slug: "tofu", name: "Tofu", aliases: ["tokwa", "tokua", "firm tofu"], g: { piece: 200 } },

  // fish and seafood
  { slug: "fish", name: "Fish", aliases: ["isda"], g: { piece: 250 } },
  { slug: "milkfish", name: "Milkfish", parent: "fish", aliases: ["bangus"], g: { piece: 400 } },
  { slug: "tilapia", name: "Tilapia", parent: "fish", aliases: [], g: { piece: 180 } },
  { slug: "round-scad", name: "Round scad", parent: "fish", aliases: ["galunggong", "gg"], g: { piece: 75 } },
  { slug: "indian-mackerel", name: "Indian mackerel", parent: "fish", aliases: ["alumahan"], g: { piece: 200 } },
  { slug: "mackerel", name: "Mackerel", parent: "fish", aliases: ["frozen mackerel"], g: { piece: 400 } },
  { slug: "spanish-mackerel", name: "Spanish mackerel", parent: "fish", aliases: ["tanigue"], g: { piece: 200 } },
  { slug: "pompano", name: "Pompano", parent: "fish", aliases: ["pampano"], g: { piece: 300 } },
  { slug: "salmon", name: "Salmon", parent: "fish", aliases: ["salmon belly"] },
  { slug: "tamban", name: "Tamban", parent: "fish", aliases: ["fresh sardines", "fresh sardine", "sardinella"], g: { piece: 50 } },
  { slug: "tuna", name: "Tuna", parent: "fish", aliases: ["tambakol", "yellowfin tuna", "bonito", "tulingan"] },
  { slug: "salmon-head", name: "Salmon head", aliases: ["ulo ng salmon"], g: { piece: 500 } },
  { slug: "squid", name: "Squid", aliases: ["pusit"], g: { piece: 100 } },
  { slug: "shrimp", name: "Shrimp", aliases: ["hipon", "prawn", "sugpo"], g: { piece: 20, cup: 150 } },
  { slug: "crab", name: "Crab", aliases: ["alimango", "alimasag"], g: { piece: 300 } },
  { slug: "mussel", name: "Mussel", aliases: ["mussels", "tahong"], g: { piece: 20 } },
  { slug: "clam", name: "Clam", aliases: ["clams", "halaan", "tulya"], g: { piece: 10, cup: 200 } },
  { slug: "canned-sardine", name: "Canned sardines", aliases: ["sardines", "sardinas", "sardines in tomato sauce", "canned sardine"], g: { can: 155 } },
  { slug: "canned-tuna", name: "Canned tuna", aliases: ["tuna flakes", "de lata na tuna"], g: { can: 155 } },

  // beef and other meat
  { slug: "beef", name: "Beef", aliases: ["baka", "karne ng baka"] },
  { slug: "beef-brisket", name: "Beef brisket", parent: "beef", aliases: ["punta y pecho"] },
  { slug: "beef-chuck", name: "Beef chuck", parent: "beef", aliases: ["kalitiran"] },
  { slug: "beef-forequarter", name: "Beef forequarter", parent: "beef", aliases: [] },
  { slug: "beef-fore-limb", name: "Beef fore limb", parent: "beef", aliases: [] },
  { slug: "beef-flank", name: "Beef flank", parent: "beef", aliases: ["kamto"] },
  { slug: "beef-loin", name: "Beef loin", parent: "beef", aliases: [] },
  { slug: "beef-plate", name: "Beef plate", parent: "beef", aliases: [] },
  { slug: "beef-rib-eye", name: "Beef rib eye", parent: "beef", aliases: ["rib eye", "ribeye"] },
  { slug: "beef-rib", name: "Beef ribs", parent: "beef", aliases: ["beef rib set", "beef short ribs", "tadyang ng baka"] },
  { slug: "beef-rump", name: "Beef rump", parent: "beef", aliases: ["tapadera"] },
  { slug: "beef-sirloin", name: "Beef sirloin", parent: "beef", aliases: ["tagiliran"] },
  { slug: "beef-striploin", name: "Beef striploin", parent: "beef", aliases: [] },
  { slug: "beef-tenderloin", name: "Beef tenderloin", parent: "beef", aliases: ["solomillo"] },
  { slug: "beef-shank", name: "Beef shank", parent: "beef", aliases: ["bulalo", "kenchi"] },
  { slug: "ground-beef", name: "Ground beef", parent: "beef", aliases: ["giniling na baka", "minced beef"] },
  { slug: "beef-tongue", name: "Beef tongue", aliases: ["dila ng baka", "lengua"] },
  { slug: "carabeef", name: "Carabeef", aliases: ["carabao meat", "karne ng kalabaw"] },
  { slug: "lamb", name: "Lamb", aliases: ["tupa"] },

  // pork
  { slug: "pork", name: "Pork", aliases: ["baboy", "karne ng baboy"] },
  { slug: "pork-belly", name: "Pork belly", parent: "pork", aliases: ["liempo"] },
  { slug: "pork-shoulder", name: "Pork shoulder", parent: "pork", aliases: ["kasim", "picnic shoulder", "boston shoulder"] },
  { slug: "pork-chop", name: "Pork chop", parent: "pork", aliases: [], g: { piece: 200 } },
  { slug: "pork-loin", name: "Pork loin", parent: "pork", aliases: ["lomo"] },
  { slug: "pork-leg", name: "Pork leg", parent: "pork", aliases: ["hind leg", "pigue"] },
  { slug: "pork-shank", name: "Pork shank", parent: "pork", aliases: ["pata", "fore shank", "hind shank", "pork hock"], g: { piece: 1000 } },
  { slug: "pork-rib", name: "Pork ribs", parent: "pork", aliases: ["spare ribs", "spareribs", "tadyang ng baboy", "buto-buto"] },
  { slug: "ground-pork", name: "Ground pork", parent: "pork", aliases: ["giniling", "giniling na baboy", "minced pork"] },
  { slug: "pork-head", name: "Pork head", aliases: ["ulo ng baboy"] },
  { slug: "pork-offal", name: "Pork offal", aliases: ["pork offals", "laman-loob ng baboy"] },
  { slug: "pork-liver", name: "Pork liver", parent: "pork-offal", aliases: ["atay ng baboy"] },
  { slug: "pork-rind", name: "Pork rind", aliases: ["pork skin", "balat ng baboy"] },
  { slug: "hotdog", name: "Hotdog", aliases: ["hot dog", "frankfurter"], g: { piece: 40, pack: 500 } },
  { slug: "longganisa", name: "Longganisa", aliases: ["longanisa", "filipino sausage"], g: { piece: 50, pack: 500 } },

  // poultry and eggs
  { slug: "chicken", name: "Chicken", aliases: ["manok", "karne ng manok"] },
  { slug: "whole-chicken", name: "Whole chicken", parent: "chicken", aliases: ["buong manok", "fully dressed chicken"], g: { piece: 1200 } },
  { slug: "chicken-breast", name: "Chicken breast", parent: "chicken", aliases: ["pitso"], g: { piece: 250 } },
  { slug: "chicken-drumstick", name: "Chicken drumstick", parent: "chicken", aliases: ["drumstick"], g: { piece: 100 } },
  { slug: "chicken-thigh", name: "Chicken thigh", parent: "chicken", aliases: ["hita ng manok"], g: { piece: 120 } },
  { slug: "chicken-wing", name: "Chicken wing", parent: "chicken", aliases: ["pakpak ng manok"], g: { piece: 90 } },
  { slug: "chicken-leg-quarter", name: "Chicken leg quarter", parent: "chicken", aliases: ["leg quarter"], g: { piece: 280 } },
  { slug: "chicken-feet", name: "Chicken feet", aliases: ["paa ng manok", "adidas"], g: { piece: 35 } },
  { slug: "chicken-neck", name: "Chicken neck", aliases: ["leeg ng manok"], g: { piece: 40 } },
  { slug: "chicken-liver", name: "Chicken liver", aliases: ["atay ng manok"], g: { piece: 40 } },
  { slug: "chicken-skin", name: "Chicken skin", aliases: ["chicken rind", "balat ng manok"] },
  { slug: "duck", name: "Duck", aliases: ["itik", "pato", "peking duck", "peckin duck"] },
  { slug: "egg", name: "Egg", aliases: ["itlog"], g: { piece: 55 } },
  { slug: "chicken-egg", name: "Chicken egg", parent: "egg", aliases: ["itlog ng manok"] },
  { slug: "quail-egg", name: "Quail egg", parent: "egg", aliases: ["itlog ng pugo"], g: { piece: 10 } },

  // vegetables
  { slug: "onion", name: "Onion", aliases: ["sibuyas"], g: { piece: 100, cup: 160 } },
  { slug: "red-onion", name: "Red onion", parent: "onion", aliases: ["sibuyas pula", "pulang sibuyas"], g: { piece: 70 } },
  { slug: "white-onion", name: "White onion", parent: "onion", aliases: ["sibuyas puti", "puting sibuyas"], g: { piece: 150 } },
  { slug: "spring-onion", name: "Spring onion", aliases: ["green onion", "scallion", "dahon ng sibuyas"], g: { stalk: 15, bundle: 100, cup: 50 } },
  { slug: "garlic", name: "Garlic", aliases: ["bawang"], g: { clove: 5, head: 40, tbsp: 9, tsp: 3 } },
  { slug: "ginger", name: "Ginger", aliases: ["luya"], g: { thumb: 15, piece: 150, tbsp: 6, tsp: 2 } },
  { slug: "lemongrass", name: "Lemongrass", aliases: ["tanglad", "tanglad stalk"], g: { stalk: 20, bundle: 100 } },
  { slug: "tomato", name: "Tomato", aliases: ["kamatis"], g: { piece: 60, cup: 180 } },
  { slug: "potato", name: "Potato", aliases: ["patatas", "white potato"], g: { piece: 150, cup: 150 } },
  { slug: "sweet-potato", name: "Sweet potato", aliases: ["kamote"], g: { piece: 200 } },
  { slug: "cassava", name: "Cassava", aliases: ["kamoteng kahoy", "balinghoy"], g: { piece: 400 } },
  { slug: "carrot", name: "Carrot", aliases: ["carrots", "karot"], g: { piece: 110, cup: 130 } },
  { slug: "bell-pepper", name: "Bell pepper", aliases: ["siling pula", "capsicum"], g: { piece: 200 } },
  { slug: "green-bell-pepper", name: "Green bell pepper", parent: "bell-pepper", aliases: ["bell pepper green"] },
  { slug: "red-bell-pepper", name: "Red bell pepper", parent: "bell-pepper", aliases: ["bell pepper red"] },
  { slug: "green-chili", name: "Long green chili", aliases: ["siling haba", "siling pansigang", "chilli green", "haba", "green chili"], g: { piece: 10 } },
  { slug: "red-chili", name: "Red chili", aliases: ["siling labuyo", "chilli red", "tingala", "bird's eye chili"], g: { piece: 2 } },
  { slug: "eggplant", name: "Eggplant", aliases: ["talong"], g: { piece: 100 } },
  { slug: "bitter-gourd", name: "Bitter gourd", aliases: ["bitter melon", "ampalaya"], g: { piece: 220 } },
  { slug: "okra", name: "Okra", aliases: [], g: { piece: 15 } },
  { slug: "string-bean", name: "String beans", aliases: ["yardlong beans", "pole sitao", "sitaw", "sitao"], g: { piece: 15, bundle: 250 } },
  { slug: "green-bean", name: "Green beans", aliases: ["baguio beans", "habichuelas", "habichuelas baguio beans"], g: { piece: 7, cup: 110 } },
  { slug: "bean-sprout", name: "Bean sprouts", aliases: ["togue", "toge", "mung bean sprouts"], g: { cup: 100 } },
  { slug: "squash", name: "Squash", aliases: ["kalabasa"], g: { cup: 140 } },
  { slug: "water-spinach", name: "Water spinach", aliases: ["kangkong"], g: { bundle: 250 } },
  { slug: "radish", name: "Radish", aliases: ["labanos"], g: { piece: 300 } },
  { slug: "taro", name: "Taro", aliases: ["gabi"], g: { piece: 80 } },
  { slug: "chayote", name: "Chayote", aliases: ["sayote"], g: { piece: 350 } },
  { slug: "moringa", name: "Moringa", aliases: ["malunggay", "malunggay leaves"], g: { cup: 20, bundle: 100 } },
  { slug: "cabbage", name: "Cabbage", aliases: ["repolyo"], g: { head: 750, cup: 70 } },
  { slug: "pechay", name: "Pechay", aliases: ["petsay", "bok choy"], g: { bundle: 250 } },
  { slug: "native-pechay", name: "Native pechay", parent: "pechay", aliases: ["pechay tagalog"] },
  { slug: "pechay-baguio", name: "Pechay Baguio", parent: "pechay", aliases: ["napa cabbage", "wombok"], g: { head: 1000 } },
  { slug: "broccoli", name: "Broccoli", aliases: [], g: { head: 400 } },
  { slug: "cauliflower", name: "Cauliflower", aliases: ["koliplor"], g: { head: 500 } },
  { slug: "celery", name: "Celery", aliases: ["kintsay"], g: { stalk: 40 } },
  { slug: "lettuce", name: "Lettuce", aliases: ["litsugas"], g: { head: 400 } },
  { slug: "green-papaya", name: "Green papaya", aliases: ["hilaw na papaya", "papaya green"], g: { piece: 1000, cup: 140 } },
  { slug: "banana-heart", name: "Banana heart", aliases: ["puso ng saging", "banana blossom"], g: { piece: 400 } },

  // fruit
  { slug: "papaya", name: "Papaya", aliases: ["ripe papaya", "solo papaya"], g: { piece: 400 } },
  { slug: "banana", name: "Banana", aliases: ["saging"], g: { piece: 100 } },
  { slug: "saba-banana", name: "Saba banana", parent: "banana", aliases: ["banana saba", "saging na saba", "saba"], g: { piece: 120 } },
  { slug: "lakatan-banana", name: "Lakatan banana", parent: "banana", aliases: ["lakatan", "banana lakatan"] },
  { slug: "latundan-banana", name: "Latundan banana", parent: "banana", aliases: ["latundan", "banana latundan"] },
  { slug: "calamansi", name: "Calamansi", aliases: ["kalamansi"], g: { piece: 15 } },
  { slug: "tamarind", name: "Tamarind", aliases: ["sampalok", "sampaloc"], g: { piece: 15 } },
  { slug: "mango", name: "Mango", aliases: ["mangga", "carabao mango"], g: { piece: 300 } },
  { slug: "avocado", name: "Avocado", aliases: [], g: { piece: 250 } },
  { slug: "melon", name: "Melon", aliases: ["cantaloupe"], g: { piece: 1500 } },
  { slug: "pomelo", name: "Pomelo", aliases: ["suha"], g: { piece: 1000 } },
  { slug: "watermelon", name: "Watermelon", aliases: ["pakwan"], g: { piece: 4000 } },
  { slug: "pineapple", name: "Pineapple", aliases: ["pinya"], g: { piece: 1200, cup: 165 } },
  { slug: "coconut", name: "Coconut", aliases: ["niyog", "buko", "grated coconut"], g: { piece: 400, cup: 80 } },
  { slug: "raisin", name: "Raisins", aliases: ["pasas"], g: { cup: 145, tbsp: 9 } },

  // pantry
  { slug: "salt", name: "Salt", aliases: ["asin"], g: { tsp: 6, tbsp: 18, cup: 290 } },
  { slug: "rock-salt", name: "Rock salt", parent: "salt", aliases: ["salt rock", "coarse salt", "magaspang na asin"], g: { tsp: 5, tbsp: 15 } },
  { slug: "iodized-salt", name: "Iodized salt", parent: "salt", aliases: ["salt iodized", "refined salt", "free flowing salt"] },
  { slug: "sugar", name: "Sugar", aliases: ["asukal"], g: { tsp: 4, tbsp: 12.5, cup: 200 } },
  { slug: "refined-sugar", name: "Refined sugar", parent: "sugar", aliases: ["sugar refined", "white sugar"] },
  { slug: "washed-sugar", name: "Washed sugar", parent: "sugar", aliases: ["sugar washed"] },
  { slug: "brown-sugar", name: "Brown sugar", parent: "sugar", aliases: ["sugar brown", "asukal na pula"], g: { cup: 220 } },
  { slug: "cooking-oil", name: "Cooking oil", aliases: ["oil", "mantika"] },
  { slug: "palm-oil", name: "Palm oil", parent: "cooking-oil", aliases: ["cooking oil palm", "palm olein"] },
  { slug: "coconut-oil", name: "Coconut oil", parent: "cooking-oil", aliases: ["cooking oil coconut", "langis ng niyog"] },
  { slug: "butter", name: "Butter", aliases: ["mantikilya"], g: { tbsp: 14, cup: 227, pack: 225 } },
  { slug: "coconut-milk", name: "Coconut milk", aliases: ["gata", "kakang gata", "coconut cream"], ml: { can: 400, pack: 200 } },
  { slug: "soy-sauce", name: "Soy sauce", aliases: ["toyo"] },
  { slug: "vinegar", name: "Vinegar", aliases: ["suka", "sukang puti", "white vinegar"] },
  { slug: "fish-sauce", name: "Fish sauce", aliases: ["patis"] },
  { slug: "shrimp-paste", name: "Shrimp paste", aliases: ["bagoong", "bagoong alamang"], g: { tsp: 6, tbsp: 17, pack: 250 } },
  { slug: "oyster-sauce", name: "Oyster sauce", aliases: [], g: { tbsp: 18, tsp: 6 } },
  { slug: "tomato-sauce", name: "Tomato sauce", aliases: ["tomato sauce pouch"], g: { cup: 245, tbsp: 15, pack: 250, can: 227 } },
  { slug: "tomato-paste", name: "Tomato paste", aliases: [], g: { tbsp: 16, pack: 70 } },
  { slug: "liver-spread", name: "Liver spread", aliases: ["liver paste"], g: { can: 85, tbsp: 15 } },
  { slug: "sinigang-mix", name: "Sinigang mix", aliases: ["tamarind soup base", "sinigang sa sampalok mix", "tamarind mix"], g: { pack: 22 } },
  { slug: "annatto", name: "Annatto", aliases: ["atsuete", "achuete", "annatto seeds"], g: { tsp: 3, tbsp: 9 } },
  { slug: "cheese", name: "Cheese", aliases: ["keso"], g: { cup: 110, tbsp: 7, pack: 165 } },
  { slug: "cornstarch", name: "Cornstarch", aliases: ["gawgaw", "corn starch"], g: { tbsp: 8, tsp: 2.7, cup: 128 } },
  { slug: "black-pepper", name: "Black pepper", aliases: ["peppercorns", "paminta", "ground black pepper"], g: { tsp: 2.3, tbsp: 7 } },
  { slug: "bay-leaf", name: "Bay leaf", aliases: ["laurel", "dahon ng laurel", "bay leaves"], g: { piece: 0.2 } },
  { slug: "misua", name: "Misua", aliases: ["miswa", "wheat vermicelli"], g: { pack: 100 } },
  { slug: "instant-noodle", name: "Instant noodles", aliases: ["instant mami", "mami noodles", "instant noodle"], g: { pack: 55 } },

  // canned meat, dairy, bread, drinks
  { slug: "corned-beef", name: "Corned beef", aliases: [], g: { can: 150, cup: 200 } },
  { slug: "beef-loaf", name: "Beef loaf", aliases: [], g: { can: 150 } },
  { slug: "meat-loaf", name: "Meat loaf", aliases: [], g: { can: 150 } },
  { slug: "luncheon-meat", name: "Luncheon meat", aliases: ["spam"], g: { can: 340 } },
  { slug: "milk", name: "Milk", aliases: ["gatas", "fresh milk"] },
  { slug: "condensed-milk", name: "Condensed milk", parent: "milk", aliases: ["sweetened condensed creamer", "sweetened condensed milk"], ml: { can: 300 } },
  { slug: "evaporated-milk", name: "Evaporated milk", parent: "milk", aliases: ["filled milk", "evap"], ml: { can: 370 } },
  { slug: "powdered-milk", name: "Powdered milk", parent: "milk", aliases: ["milk powder", "gatas na pulbos"], g: { cup: 130, tbsp: 8, pack: 150 } },
  { slug: "bread", name: "Bread", aliases: ["tinapay"], g: { piece: 30 } },
  { slug: "pandesal", name: "Pandesal", parent: "bread", aliases: ["pan de sal"], g: { piece: 30, pack: 300 } },
  { slug: "loaf-bread", name: "Loaf bread", parent: "bread", aliases: ["sliced bread", "tasty"], g: { piece: 25, pack: 600 } },
  { slug: "coffee", name: "Coffee", aliases: ["kape", "3-in-1 coffee"], g: { pack: 20, tsp: 2, tbsp: 6 } },
];
