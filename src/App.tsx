/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  Instagram, 
  ArrowRight, 
  Menu, 
  X,
  Leaf,
  Droplets,
  Home,
  Package,
  Search,
  MessageCircle,
  Clock,
  ChevronRight,
  Info,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Save,
  Upload,
  AlertCircle,
  Settings,
  Lock
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, auth, storage } from './lib/firebase';

// --- Types ---
type View = 'home' | 'bazaar' | 'story' | 'contact' | 'cart' | 'admin';

type Product = {
  id: string; // Changed to string for Firestore ID
  name: string;
  origin: string;
  price: string;
  description: string;
  image: string;
  tag: string;
  category: string;
};

type CartItem = Product & { quantity: number };

type AdminCheckStatus = 'signed-out' | 'checking' | 'authorized' | 'unauthorized' | 'error';

const ADMIN_EMAILS = new Set(['12134189a@gmail.com']);

const FIREBASE_ERROR_HINTS: Record<string, string> = {
  'auth/unauthorized-domain': 'Add this local host to Firebase Console > Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed': 'Enable Google in Firebase Console > Authentication > Sign-in method.',
  'auth/popup-closed-by-user': 'The Google popup was closed before sign-in completed.',
  'auth/cancelled-popup-request': 'Another sign-in popup was already in progress.',
  'auth/popup-blocked': 'The browser blocked the Google popup. Allow popups for this local site.',
  'auth/invalid-api-key': 'Check that the Firebase config API key belongs to this project.',
  'permission-denied': 'Firestore rejected the request. Check the signed-in account, admin document, database ID, and security rules.',
  'not-found': 'The requested Firestore resource was not found. Check the configured Firestore database ID.',
};

const formatFirebaseError = (error: unknown, fallback: string) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : null;
  const message = error instanceof Error ? error.message : String(error);
  const hint = code ? FIREBASE_ERROR_HINTS[code] : undefined;

  return [
    fallback,
    code ? `(${code})` : null,
    message ? `- ${message}` : null,
    hint ? `Hint: ${hint}` : null,
  ].filter(Boolean).join(' ');
};

const createGoogleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

// --- Real Products Catalog (50 Items) ---
const PRODUCTS: Product[] = [
  // Beverages
  { id: "1", name: "Café Najjar Classic", origin: "Najjar", price: "4.50", description: "Smooth, aromatic vacuum-sealed Lebanese coffee with a hint of cardamom.", image: "https://najjar.com/wp-content/uploads/2021/04/Najjar-Vacuum-200g.png", tag: "Essential", category: "Beverages" },
  { id: "2", name: "Bonjus Pineapple", origin: "Bonjus", price: "0.40", description: "The nostalgic taste of Lebanon. Pure pineapple juice in the classic pyramid pack.", image: "https://www.bonjus.com/wp-content/uploads/2018/10/Bonjus-Pyramid-Pineapple.png", tag: "Nostalgic", category: "Beverages" },
  { id: "3", name: "Rim Natural Water 1.5L", origin: "Rim", price: "0.60", description: "Pure mineral water from the high filtration layers of Mount Sannine.", image: "https://rimwater.com/wp-content/uploads/2019/06/rim-bottle-1.5L.png", tag: "Daily", category: "Beverages" },
  { id: "4", name: "Kassatly Chtaura Jallab", origin: "Kassatly", price: "5.50", description: "Authentic Jallab syrup made from dates, grape molasses, and rose water.", image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80", tag: "Tradition", category: "Beverages" },
  { id: "5", name: "Almaza Pilsener (Non-Alc)", origin: "Almaza", price: "1.20", description: "Lebanon's favorite brew, non-alcoholic version for a refreshing crisp taste.", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80", tag: "Local", category: "Beverages" },
  { id: "6", name: "Vimto Fruit Cordial", origin: "Vimto", price: "4.80", description: "The iconic berry-flavored syrup, a staple for every Lebanese household.", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80", tag: "Classic", category: "Beverages" },
  { id: "7", name: "Pepsi 330ml Can", origin: "Pepsico Leb", price: "0.50", description: "Chilled Pepsi-Cola, the perfect companion for every manoushe.", image: "https://images.unsplash.com/photo-1629203851022-39c6f25c719e?w=800&q=80", tag: "Daily", category: "Beverages" },
  { id: "8", name: "7-Up Liquid Gold", origin: "Pepsico Leb", price: "0.50", description: "Crisp lemon-lime refreshment for those hot Aramoun afternoons.", image: "https://images.unsplash.com/photo-1625772290748-39126cdd9fe9?w=800&q=80", tag: "Refreshing", category: "Beverages" },
  { id: "9", name: "Tanbourit Rose Water", origin: "Rabih", price: "2.80", description: "Natural rose water distilled for desserts and authentic Lebanese recipes.", image: "https://images.unsplash.com/photo-1615485242217-1f4a43b17c7d?w=800&q=80", tag: "Cooking", category: "Mouneh" },
  { id: "10", name: "Arak Brun 50cl", origin: "Domaine de Tourelles", price: "12.50", description: "World-class Arak distilled with high quality green anise seeds.", image: "https://images.unsplash.com/photo-1582650911717-3e922e39a531?w=800&q=80", tag: "Heritage", category: "Beverages" },

  // Snacks & Sweets
  { id: "11", name: "Gandour Unica", origin: "Gandour", price: "0.50", description: "Thin, crispy wafers covered in smooth milk chocolate. The legendary snack.", image: "https://gandour.com/wp-content/uploads/2019/11/Unica-Main.png", tag: "Iconic", category: "Snacks" },
  { id: "12", name: "Gandour Dabke Lemon", origin: "Gandour", price: "0.40", description: "Lemon creme-filled biscuits that take you back to school days.", image: "https://gandour.com/wp-content/uploads/2019/11/Dabke-Lemon.png", tag: "Kids Favorite", category: "Snacks" },
  { id: "13", name: "Master Chips Salt", origin: "Master", price: "0.30", description: "Thin, crunchy potato chips seasoned with sea salt.", image: "https://masterchips.com/wp-content/uploads/2020/06/Salt-Pack.png", tag: "Popular", category: "Snacks" },
  { id: "14", name: "Fantasia Cheese Puffs", origin: "Fantasia", price: "0.35", description: "Lightly baked corn puffs coated in a delicious cheese blend.", image: "https://images.unsplash.com/photo-1599490659213-e2b9527bb087?w=800&q=80", tag: "Classic", category: "Snacks" },
  { id: "15", name: "Tarabichi Salted Peanuts", origin: "Tarabichi", price: "0.75", description: "Crunchy, roasted peanuts perfectly salted for evening gatherings.", image: "https://images.unsplash.com/photo-1567113331908-727daef14c9f?w=800&q=80", tag: "Meza", category: "Snacks" },
  { id: "16", name: "Pik-One Chocolate Bar", origin: "Gandour", price: "0.60", description: "Satisfying wafer fingers dipped in rich Gandour chocolate.", image: "https://gandour.com/wp-content/uploads/2019/11/Pik-One.png", tag: "Sweet", category: "Snacks" },
  { id: "17", name: "Tottis Chocolate Croissant", origin: "Tottis", price: "0.55", description: "Soft, flaky croissant filled with rich chocolate hazelnut cream.", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80", tag: "Breakfast", category: "Snacks" },
  { id: "18", name: "Kinder Joy Surprise", origin: "Kinder", price: "1.50", description: "Delicious milky cream with cocoa biscuits and a hidden surprise toy.", image: "https://images.unsplash.com/photo-1621236304831-72296ee933as?w=800&q=80", tag: "Refined", category: "Snacks" },
  { id: "19", name: "Nutella Hazelnut 350g", origin: "Nutella", price: "5.80", description: "The world's favorite hazelnut cocoa spread, loved by all generations.", image: "https://images.unsplash.com/photo-1559181567-c319079b640a?w=800&q=80", tag: "Must Have", category: "Snacks" },
  { id: "20", name: "Indomie Chicken Flavour", origin: "Indomie", price: "0.45", description: "Quick, tasty, and satisfying instant noodles for a fast meal.", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80", tag: "Fast", category: "Snacks" },

  // Deli & Dairy (Lebanese Baladi)
  { id: "21", name: "Taanayel Baladi Labneh", origin: "Taanayel", price: "3.50", description: "Extra creamy, authentic strained yogurt made from 100% fresh cow milk.", image: "https://www.taanayel.com/uploads/product/product-500g.png", tag: "Baladi", category: "Deli" },
  { id: "22", name: "Halloumi Cheese 250g", origin: "Dairiday", price: "4.20", description: "Firm, salty Lebanese halloumi, perfect for grilling or frying.", image: "https://images.unsplash.com/photo-1559561853-08451557c7f9?w=800&q=80", tag: "Fresh", category: "Deli" },
  { id: "23", name: "Picon 8 Portions Cheese", origin: "Bel Leb", price: "1.60", description: "The legendary triangle cheese for every Lebanese school sandwich.", image: "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800&q=80", tag: "Iconic", category: "Deli" },
  { id: "24", name: "Akkawi Cheese Baladi", origin: "Mountain Artisans", price: "3.90", description: "Salty white cheese, essential for making the perfect Knefeh or Manoushe.", image: "https://images.unsplash.com/photo-1624806994096-7f201d901851?w=800&q=80", tag: "Traditional", category: "Deli" },
  { id: "25", name: "Lurpak Salted Butter 200g", origin: "Lurpak", price: "3.80", description: "Pure creamery butter, perfect for spreading on fresh Lebanese bread.", image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&q=80", tag: "Premium", category: "Deli" },
  { id: "26", name: "Kashkaval Cheese 400g", origin: "Mavrakis", price: "6.20", description: "Semi-hard yellow cheese with a rich, buttery flavor.", image: "https://images.unsplash.com/photo-1485950938660-55d4999bfe0a?w=800&q=80", tag: "Gourmet", category: "Deli" },
  { id: "27", name: "Taanayel Fresh Ayran 1L", origin: "Taanayel", price: "1.80", description: "Chilled, frothy yogurt drink with just the right amount of salt.", image: "https://images.unsplash.com/photo-1571290274554-e91b18af330c?w=800&q=80", tag: "Refreshing", category: "Beverages" },
  { id: "28", name: "Baladi Goat Yogurt", origin: "Mountain Dairy", price: "2.90", description: "Handcrafted yogurt from mountain goats, rich in probiotics.", image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80", tag: "Healthy", category: "Deli" },
  { id: "29", name: "Double Cream Cheese", origin: "Lactalis Leb", price: "2.50", description: "Smooth, spreadable cream cheese for the perfect breakfast bagel.", image: "https://images.unsplash.com/photo-1528280058557-4f5ec4bc1d57?w=800&q=80", tag: "Daily", category: "Deli" },
  { id: "30", name: "Sliced Turkey Breast", origin: "Al Mayadeen", price: "5.50/lb", description: "Freshly sliced premium turkey breast for deli-style sandwiches.", image: "https://images.unsplash.com/photo-1506484334402-40f299735d1c?w=800&q=80", tag: "Protein", category: "Deli" },

  // Mouneh & Pantry
  { id: "31", name: "Chtaura Hummus 400g", origin: "Chtaura", price: "1.20", description: "Smooth, ready-to-eat chickpea dip. Just add a drizzle of olive oil.", image: "https://images.unsplash.com/photo-1577906030551-5b1286668741?w=800&q=80", tag: "Essential", category: "Mouneh" },
  { id: "32", name: "Al Wadi Fava Beans", origin: "Al Wadi", price: "1.10", description: "Premium Fava beans (Foul Mudammas), the heart of Lebanese breakfast.", image: "https://images.unsplash.com/photo-1540331030864-bc2b0129bc13?w=800&q=80", tag: "Daily", category: "Mouneh" },
  { id: "33", name: "Extra Virgin Olive Oil 1L", origin: "Koura Valley", price: "14.50", description: "Cold-pressed olive oil from the historic groves of Koura.", image: "https://images.unsplash.com/photo-1474979266404-7eaacbacf825?w=800&q=80", tag: "Heritage", category: "Mouneh" },
  { id: "34", name: "Al Wadi Tahina 400g", origin: "Al Wadi", price: "3.80", description: "100% pure sesame paste for the finest hummus and dressings.", image: "https://images.unsplash.com/photo-1610450949065-1f280e251b3a?w=800&q=80", tag: "Pantry", category: "Mouneh" },
  { id: "35", name: "Cortas Pomegranate Molasses", origin: "Cortas", price: "3.50", description: "Rich, tangy reduction of pomegranate juice for salads and meats.", image: "https://images.unsplash.com/photo-1541345023926-55d6e08bb369?w=800&q=80", tag: "Aromatic", category: "Mouneh" },
  { id: "36", name: "Wild Thyme Zaatar Duo", origin: "Shouf Mountains", price: "5.20", description: "Hand-picked wild thyme blended with local sumac and roasted sesame.", image: "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=800&q=80", tag: "Organic", category: "Mouneh" },
  { id: "37", name: "Stuffed Makdous Jar", origin: "Home Kitchen", price: "15.00", description: "Cured eggplants stuffed with walnuts and garlic in local olive oil.", image: "https://images.unsplash.com/photo-1523450001312-faa4e2e31f0f?w=800&q=80", tag: "Crafted", category: "Mouneh" },
  { id: "38", name: "555 Tuna in Oil", origin: "Pacific Mills", price: "1.45", description: "High-quality white meat tuna chunks in vegetable oil.", image: "https://images.unsplash.com/photo-1563245372-f21d1d94380b?w=800&q=80", tag: "Pantry", category: "Mouneh" },
  { id: "39", name: "Heinz Tomato Ketchup 460g", origin: "Heinz Leb", price: "2.90", description: "The thickest, richest tomato ketchup you can find in Lebanon.", image: "https://images.unsplash.com/photo-1585325610266-7ab56f8f533a?w=800&q=80", tag: "Standard", category: "Mouneh" },
  { id: "40", name: "Maggi Chicken Bouillon", origin: "Maggi Leb", price: "3.60", description: "Cubes that add the essential flavor to all your mountain stews.", image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80", tag: "Cooking", category: "Mouneh" },

  // Household Essentials
  { id: "41", name: "Tide Automatic Power 2.5kg", origin: "Procter & Gamble", price: "8.50", description: "Legendary laundry detergent for the brightest whites and colors.", image: "https://images.unsplash.com/photo-1610557892470-55d9e80e0bce?w=800&q=80", tag: "Heavy Duty", category: "Household" },
  { id: "42", name: "Fairy Liquid Lemon 450ml", origin: "Procter & Gamble", price: "1.90", description: "Voted #1 for cutting through the toughest grease in Lebanon.", image: "https://images.unsplash.com/photo-1584622781564-1d9876a13d00?w=800&q=80", tag: "Effective", category: "Household" },
  { id: "43", name: "Fine Facial Tissues 2ply", origin: "Fine Hygienic", price: "2.50", description: "Sterilized for 100% germ protection and cloud-like softness.", image: "https://images.unsplash.com/photo-1614251025595-3bc49842523e?w=800&q=80", tag: "Essential", category: "Household" },
  { id: "44", name: "Mimosa Toilet Paper 4R", origin: "Mimosa Leb", price: "2.80", description: "High-absorbency, pure white bathroom tissues for daily family use.", image: "https://images.unsplash.com/photo-1584622781514-f63404ecb4b3?w=800&q=80", tag: "Family Pack", category: "Household" },
  { id: "45", name: "Dettol Multi-Action 900ml", origin: "Reckitt Leb", price: "4.20", description: "Kill 99.9% of germs on all surfaces in your mountain home.", image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80", tag: "Protection", category: "Household" },
  { id: "46", name: "Head & Shoulders Mint 400ml", origin: "Procter & Gamble", price: "5.50", description: "Dandruff protection with a cool menthol blast for fresh mornings.", image: "https://images.unsplash.com/photo-1552046122-03184de85e08?w=800&q=80", tag: "Personal Care", category: "Household" },
  { id: "47", name: "Signal Cavity Toothpaste", origin: "Unilever Leb", price: "1.60", description: "Pro-fluoride system that keeps your family's smiles bright and healthy.", image: "https://images.unsplash.com/photo-1559591937-e62e1974100c?w=800&q=80", tag: "Personal Care", category: "Household" },
  { id: "48", name: "Gillette Blue II Razors 5pk", origin: "Gillette", price: "3.20", description: "Fixed-head razors for a smooth, close shave every time.", image: "https://images.unsplash.com/photo-1503926359680-9031c191a317?w=800&q=80", tag: "Essentials", category: "Household" },
  { id: "49", name: "Persil Liquid Gel 1L", origin: "Henkel Leb", price: "6.20", description: "German tech for millions of stain removers in every drop.", image: "https://images.unsplash.com/photo-1583947215259-38e31be87dd1?w=800&q=80", tag: "Premium", category: "Household" },
  { id: "50", name: "Ajax Floral Cleaner 1L", origin: "Colgate Palmolive", price: "2.40", description: "Leaves your floors sparkling with the scent of wild mountain flowers.", image: "https://images.unsplash.com/photo-1550963295-019d8a8a61c5?w=800&q=80", tag: "Daily", category: "Household" },
];

const CATEGORIES = [
  { id: 'all', name: "Everything", icon: Package },
  { id: 'beverages', name: "Drinks", icon: Droplets },
  { id: 'snacks', name: "Snacks", icon: Leaf },
  { id: 'mouneh', name: "Mouneh", icon: Package },
  { id: 'deli', name: "Deli", icon: Info },
  { id: 'household', name: "Household", icon: Home }
];

// --- Improved Image Component ---
const ProductImage = ({ src, name, className }: { src: string, name: string, className?: string }) => {
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Use weserv proxy to bypass referrer and CORS issues
  const proxiedSrc = src.includes('pexels') || src.includes('unsplash') 
    ? `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=600&h=600&fit=cover&q=80`
    : src;

  return (
    <div className={`relative w-full h-full bg-zinc-100 overflow-hidden ${className}`}>
      {!loaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 animate-pulse">
           <Package size={32} className="text-zinc-200" />
        </div>
      )}
      
      {imageError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-100 italic font-serif text-zinc-400">
          <Package size={24} className="mb-2 opacity-20" />
          <span className="text-[10px] uppercase tracking-tighter">{name}</span>
        </div>
      ) : (
        <img 
          src={proxiedSrc} 
          alt={name}
          className={`w-full h-full object-cover transition-all duration-700 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
};


// --- Components ---

const NavItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center space-y-1 w-full py-2 transition-all ${active ? 'text-lebanese-cedar' : 'text-zinc-400'}`}
  >
    <Icon size={active ? 24 : 22} strokeWidth={active ? 2.5 : 2} />
    <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {active && <motion.div layoutId="nav-glow" className="absolute -bottom-1 w-1 h-1 bg-lebanese-cedar rounded-full" />}
  </button>
);

const SectionTitle = ({ title, subtitle, centered = false }: { title: string, subtitle?: string, centered?: boolean }) => (
  <div className={`mb-10 ${centered ? 'text-center' : ''}`}>
    <span className="text-lebanese-gold text-[10px] font-bold tracking-[0.3em] uppercase mb-2 block">{subtitle}</span>
    <h2 className="text-3xl font-serif text-lebanese-cedar leading-tight">{title}</h2>
  </div>
);

const HeroImage = ({ name, type = 'hero', label }: { name: string, type?: 'product' | 'hero' | 'story' | 'map', label?: string }) => {
  const getGradient = () => {
    if (type === 'hero') return 'from-lebanese-cedar via-lebanese-cedar/90 to-lebanese-cedar/70 text-white';
    if (type === 'story') return 'from-lebanese-cedar to-emerald-900 text-white';
    if (type === 'map') return 'from-zinc-100 to-zinc-200 text-zinc-400';
    return 'from-lebanese-cedar to-emerald-950 text-white';
  };

  const images = {
    hero: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=1200&q=80",
    story: "https://images.unsplash.com/photo-1518115594042-42da491c1214?w=1200&q=80",
    map: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=1200&q=80"
  };

  return (
    <div className={`w-full h-full relative overflow-hidden bg-gradient-to-br ${getGradient()} flex items-center justify-center p-8`}>
      <img 
        src={images[type as keyof typeof images] || images.hero}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
      />
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      
      <div className="relative z-10 text-center space-y-6">
        {type === 'map' ? (
          <div className="flex flex-col items-center gap-2">
            <MapPin size={48} strokeWidth={1} />
            <span className="text-[10px] font-black uppercase tracking-widest">Transit Aramoun</span>
          </div>
        ) : (
          <>
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 64 }}
              className="w-[1px] bg-current opacity-30 mx-auto" 
            />
            <h3 className={`font-serif uppercase leading-none ${type === 'hero' ? 'text-2xl md:text-5xl' : 'text-xs md:text-sm'} tracking-[0.2em] px-4`}>
              {label || name}
            </h3>
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 64 }}
              className="w-[1px] bg-current opacity-30 mx-auto" 
            />
          </>
        )}
      </div>

      <div className="absolute top-8 left-8 w-8 h-8 border-l border-t border-current opacity-20" />
      <div className="absolute bottom-8 right-8 w-8 h-8 border-r border-b border-current opacity-20" />
    </div>
  );
};


export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminCheckStatus, setAdminCheckStatus] = useState<AdminCheckStatus>('checking');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!mounted) return;

      setUser(u);
      setAuthError(null);

      if (!u) {
        setIsAdmin(false);
        setAdminCheckStatus('signed-out');
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      setAdminCheckStatus('checking');

      try {
        const isAdminEmail = !!u.email && ADMIN_EMAILS.has(u.email.toLowerCase());
        const adminDoc = await getDoc(doc(db, 'admins', u.uid));

        if (!mounted) return;

        const hasAdminRole = isAdminEmail || adminDoc.exists();
        setIsAdmin(hasAdminRole);
        setAdminCheckStatus(hasAdminRole ? 'authorized' : 'unauthorized');

        if (!hasAdminRole) {
          setAuthError(
            `Admin access denied (admin/missing-role) - Signed in as ${u.email ?? u.uid}. UID: ${u.uid}. To grant access, create a Firestore document at admins/${u.uid} in the default database, or sign in with the bootstrap admin email 12134189a@gmail.com.`
          );
        }
      } catch (error) {
        const message = formatFirebaseError(error, 'Admin role check failed');
        console.error(message, error);

        if (!mounted) return;

        setIsAdmin(false);
        setAdminCheckStatus('error');
        setAuthError(message);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }, (error) => {
      const message = formatFirebaseError(error, 'Firebase auth state listener failed');
      console.error(message, error);

      if (!mounted) return;

      setUser(null);
      setIsAdmin(false);
      setAdminCheckStatus('error');
      setAuthError(message);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Products Listener
  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(items);
      setProductsError(null);
      setLoading(false);
    }, (error) => {
      const message = formatFirebaseError(error, 'Firestore products listener failed');
      console.error(message, error);
      setProductsError(message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async () => {
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, createGoogleProvider());
      console.info('Google sign-in completed.', {
        uid: result.user.uid,
        email: result.user.email,
      });
    } catch (error) {
      const message = formatFirebaseError(error, 'Google sign-in failed');
      console.error(message, error);
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  // Seed data if empty (Admin only)
  const seedData = async () => {
    if (!isAdmin || products.length > 0) return;
    const batch = writeBatch(db);
    PRODUCTS.forEach((p) => {
      const { id, ...data } = p;
      const ref = doc(collection(db, 'products'));
      batch.set(ref, data);
    });
    try {
      await batch.commit();
    } catch (error) {
      const message = formatFirebaseError(error, 'Seeding products failed');
      console.error(message, error);
      setAuthError(message);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigateToBazaar = (category: string = 'all') => {
    setActiveFilter(category);
    setCurrentView('bazaar');
    window.scrollTo(0, 0);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const itemString = cart.map(i => `- ${i.quantity}x ${i.name} ($${(parseFloat(i.price) * i.quantity).toFixed(2)})`).join('%0A');
    const message = `Hello Transit Market! I would like to order:%0A${itemString}%0A%0ATotal: $${cartTotal.toFixed(2)}`;
    window.open(`https://wa.me/96176425159?text=${message}`, '_blank');
  };

  const renderView = () => {
    switch (currentView) {
      case 'home': return <HomeView products={products} onShopNow={() => navigateToBazaar()} onCategoryClick={navigateToBazaar} onProductClick={setSelectedProduct} />;
      case 'bazaar': return <BazaarView products={products} onProductClick={setSelectedProduct} onAddToCart={addToCart} activeFilter={activeFilter} setActiveFilter={setActiveFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />;
      case 'story': return <StoryView />;
      case 'contact': return <ContactView />;
      case 'cart': return <CartView cart={cart} onUpdateQty={updateQuantity} onRemove={removeFromCart} onCheckout={handleCheckout} />;
      case 'admin': return (
        <AdminView
          products={products}
          isAdmin={isAdmin}
          authLoading={authLoading}
          adminCheckStatus={adminCheckStatus}
          authError={authError}
          user={user}
          isSigningIn={isSigningIn}
          onLogin={login}
          onLogout={logout}
          onSeed={seedData}
          onError={setAuthError}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-lebanese-stone text-zinc-900 font-sans pb-24 overflow-x-hidden">
      {/* Pattern Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 30l15 15m-30 0l15-15m15-15L30 30m0 0L15 15' stroke='%231a4331' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />

      {(authError || productsError) && (
        <div role="alert" className="fixed top-20 left-4 right-4 z-[120] mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-4 text-left shadow-2xl shadow-red-900/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 flex-shrink-0 text-red-600" size={20} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-red-700">Firebase sign-in or data error</p>
              <p className="mt-1 break-words text-xs leading-relaxed text-zinc-600">{authError || productsError}</p>
            </div>
            <button
              onClick={() => {
                setAuthError(null);
                setProductsError(null);
              }}
              className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Dismiss Firebase error"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Top Header - Minimal for Mobile */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'glass-nav h-16 shadow-lg shadow-lebanese-cedar/5' : 'h-20'}`}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex flex-col cursor-pointer group" onClick={() => setCurrentView('home')}>
            <span className="text-xl font-serif font-black tracking-tighter text-lebanese-cedar leading-none flex items-center gap-1">
              TRANSIT <span className="text-lebanese-gold transition-colors group-hover:text-lebanese-cedar underline underline-offset-4 decoration-lebanese-gold/30">MARKET</span>
            </span>
            <span className="text-[7px] font-black tracking-[0.4em] text-zinc-400 uppercase mt-0.5">Tradition of Aramoun</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button 
                onClick={() => setCurrentView('admin')}
                className={`p-2 rounded-full transition-colors ${currentView === 'admin' ? 'bg-lebanese-cedar text-white' : 'text-lebanese-cedar hover:bg-lebanese-cedar/5'}`}
                title="Admin Dashboard"
              >
                <Settings size={22} />
              </button>
            ) : (
              <button 
                onClick={login}
                disabled={isSigningIn || authLoading}
                className="text-lebanese-cedar p-2 hover:bg-lebanese-cedar/5 rounded-full transition-colors disabled:cursor-wait disabled:opacity-50"
                title={isSigningIn || authLoading ? "Checking sign-in status" : "Staff Login"}
              >
                {isSigningIn || authLoading ? <Clock size={22} className="animate-spin" /> : <LogIn size={22} />}
              </button>
            )}
            <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className="text-lebanese-cedar p-2 hover:bg-lebanese-cedar/5 rounded-full transition-colors"
            >
              <Search size={22} />
            </button>
            <div className="relative cursor-pointer p-2 hover:bg-lebanese-cedar/5 rounded-full transition-colors" onClick={() => setCurrentView('cart')}>
              <ShoppingBag size={22} className="text-lebanese-cedar" />
              {cartCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 right-1 bg-lebanese-gold text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black"
                >
                  {cartCount}
                </motion.span>
              )}
            </div>
          </div>
        </div>
        
        {/* Search Bar Overlay */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 right-0 bg-white border-b px-6 py-4 shadow-xl"
            >
              <div className="flex items-center gap-3 bg-zinc-100 rounded-2xl px-4 py-3">
                <Search size={18} className="text-zinc-400" />
                <input 
                  autoFocus
                  placeholder="What are you looking for?" 
                  className="bg-transparent border-none focus:outline-none text-sm w-full font-light"
                />
                <button onClick={() => setSearchOpen(false)}><X size={18} className="text-zinc-400" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      
      {/* Main Content Area */}
      <main className="pt-20 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
            onAddToCart={(p) => {
              addToCart(p);
              setSelectedProduct(null);
            }} 
          />
        )}
      </AnimatePresence>

      {/* Modern Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav h-16 border-t flex items-center justify-around px-6 md:hidden">
        <NavItem icon={Home} label="Home" active={currentView === 'home'} onClick={() => setCurrentView('home')} />
        <NavItem icon={ShoppingBag} label="Shop" active={currentView === 'bazaar'} onClick={() => setCurrentView('bazaar')} />
        <NavItem icon={Info} label="Story" active={currentView === 'story'} onClick={() => setCurrentView('story')} />
        <NavItem icon={Phone} label="Contact" active={currentView === 'contact'} onClick={() => setCurrentView('contact')} />
      </nav>

      {/* Order Floating Button - Primarily for WhatsApp */}
      <a 
        href="https://wa.me/96176425159" 
        className="fixed bottom-20 right-6 z-40 bg-lebanese-cedar text-white p-4 rounded-full shadow-2xl shadow-lebanese-cedar/40 flex items-center justify-center group"
      >
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 font-medium whitespace-nowrap">Order on WhatsApp</span>
      </a>

      {/* Global Footer */}
      <footer className="px-6 py-12 border-t border-zinc-200/50 bg-white/50 relative z-10 w-full mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
            <button onClick={() => setCurrentView('home')} className="hover:text-lebanese-cedar transition-colors">Home</button>
            <button onClick={() => navigateToBazaar()} className="hover:text-lebanese-cedar transition-colors">Market</button>
            <button onClick={() => setCurrentView('story')} className="hover:text-lebanese-cedar transition-colors">Our Story</button>
            <button onClick={() => setCurrentView('contact')} className="hover:text-lebanese-cedar transition-colors">Contact</button>
            <button 
              onClick={isAdmin ? () => setCurrentView('admin') : login} 
              disabled={!isAdmin && (isSigningIn || authLoading)}
              className={`hover:text-lebanese-gold transition-colors flex items-center gap-1 disabled:cursor-wait disabled:opacity-50 ${isAdmin ? 'text-lebanese-gold' : ''}`}
            >
              <Lock size={10} />
              {isAdmin ? 'Admin Dashboard' : (isSigningIn || authLoading ? 'Checking Access' : 'Staff Login')}
            </button>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-serif text-lebanese-cedar opacity-30">TRANSIT MARKET</p>
            <p className="text-[9px] text-zinc-300 font-medium">© 2024 Transit Market Aramoun. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- View: Home ---
function HomeView({ products, onShopNow, onCategoryClick, onProductClick }: { products: Product[], onShopNow: () => void, onCategoryClick: (c: string) => void, onProductClick: (p: Product) => void }) {
  return (
    <div className="space-y-12 pb-12">
      {/* Mobile Hero */}
      <section className="px-6">
        <div className="relative h-[65vh] rounded-[48px] overflow-hidden flex flex-col justify-end p-8 shadow-2xl shadow-lebanese-cedar/30">
          <div className="absolute inset-0">
             <HeroImage 
               name="Home Hero" 
               type="hero" 
               label="The Transit Market" 
             />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-lebanese-cedar/95 via-lebanese-cedar/40 to-transparent" />
          <div className="relative z-10 text-white">
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase mb-4 border border-white/20"
            >
              Aramoun • Local • Fresh
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-serif mb-4 leading-[0.95]"
            >
              True <br />
              <span className="serif-italic text-lebanese-gold">Lebanese</span> <br />
              Flavors.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-emerald-50/70 mb-8 max-w-[280px] font-light leading-relaxed"
            >
              Curated local goods directly from the mountain groves to your kitchen.
            </motion.p>
            <button 
              onClick={onShopNow}
              className="w-full bg-white text-lebanese-cedar font-black py-6 rounded-3xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all shadow-xl shadow-black/20"
            >
              <span>Explore The Bazaar</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Categories Grid (No horizontal scrolling) */}
      <section className="px-6">
        <div className="flex justify-between items-center mb-6 px-1">
          <h2 className="text-2xl font-serif text-lebanese-cedar">Browse</h2>
          <button onClick={() => onShopNow()} className="text-lebanese-gold text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-lebanese-gold/10 rounded-xl">View Market</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat.id} 
              onClick={() => onCategoryClick(cat.id)}
              className="group relative h-32 rounded-[32px] overflow-hidden bg-white border border-zinc-100 p-6 flex flex-col items-center justify-center text-center shadow-sm active:scale-95 transition-all hover:border-lebanese-gold/30"
            >
              <div className="w-12 h-12 rounded-2xl bg-lebanese-stone/50 flex items-center justify-center mb-2 group-hover:bg-lebanese-gold/10 transition-colors">
                <cat.icon size={24} className="text-lebanese-cedar group-hover:text-lebanese-gold transition-colors" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-lebanese-cedar transition-colors leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Seasonal Highlights with Decorative Borders */}
      <section className="px-6 relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-lebanese-gold/5 blur-3xl rounded-full -z-10" />
        
        {/* Decorative Corner Element */}
        <div className="absolute top-0 left-6 w-12 h-12 border-l-2 border-t-2 border-lebanese-gold/30 rounded-tl-xl pointer-events-none" />
        
        <SectionTitle title="Weekly Highs" subtitle="The Pick of Aramoun" />
        
        <div className="grid grid-cols-1 gap-8">
          {products.filter(p => p.tag === "Iconic" || p.tag === "Essential").slice(0, 3).map((item) => (
            <motion.div 
              whileHover={{ y: -5 }}
              key={item.id} 
              onClick={() => onProductClick(item)}
              className="group relative rounded-[48px] overflow-hidden aspect-[4/3] bg-white shadow-xl shadow-zinc-200/50 cursor-pointer border border-white"
            >
              <ProductImage name={item.name} src={item.image} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute border-[0.5px] border-white/20 inset-6 rounded-[32px] pointer-events-none" />
              <div className="absolute bottom-10 left-10 right-10 text-white">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-lebanese-gold text-[8px] font-black uppercase tracking-[0.3em] mb-2 block">{item.tag} • {item.category}</span>
                    <h3 className="text-3xl font-serif mb-1">{item.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{item.origin}</p>
                  </div>
                  <span className="text-2xl font-display font-medium text-lebanese-gold">${item.price}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Decorative Bottom Corner */}
        <div className="absolute bottom-0 right-6 w-12 h-12 border-r-2 border-b-2 border-lebanese-gold/30 rounded-br-xl pointer-events-none translate-y-6" />
      </section>

      {/* Lebanese Cultural Quote Divider */}
      <section className="px-6 py-6 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-[1px] flex-1 bg-lebanese-gold/20" />
          <Leaf className="text-lebanese-gold/40" size={20} />
          <div className="h-[1px] flex-1 bg-lebanese-gold/20" />
        </div>
        <p className="font-serif italic text-lebanese-cedar/60 text-sm leading-relaxed">
          "The bounty of Lebanon, <br />
          delivered with the spirit of Aramoun."
        </p>
      </section>
      {/* Trust Badges with Decorative Border */}
      <section className="px-6 mb-12">
        <div className="bg-lebanese-cedar rounded-[48px] p-10 text-center relative overflow-hidden border-4 border-lebanese-gold/20">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
          
          {/* Decorative Corner Motif */}
          <div className="absolute top-4 right-4 text-lebanese-gold/20">
            <Leaf size={48} strokeWidth={0.5} />
          </div>
          
          <div className="grid grid-cols-2 gap-10 relative z-10">
            <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 border border-white/10 shadow-inner">
                <Package className="text-lebanese-gold" size={24} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-1">Earth Conscious</h4>
              <p className="text-[9px] text-white/40 leading-tight">Zero Plastic Lebanese Goods</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 border border-white/10 shadow-inner">
                <Clock className="text-lebanese-gold" size={24} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-1">Mountain Speed</h4>
              <p className="text-[9px] text-white/40 leading-tight">Daily Dispatch in Aramoun</p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}


// --- View: Bazaar ---
function BazaarView({ products, onProductClick, onAddToCart, activeFilter, setActiveFilter, searchTerm, setSearchTerm }: { products: Product[], onProductClick: (p: Product) => void, onAddToCart: (p: Product) => void, activeFilter: string, setActiveFilter: (f: string) => void, searchTerm: string, setSearchTerm: (s: string) => void }) {
  const filteredProducts = products.filter(p => {
    const matchesFilter = activeFilter === 'all' || p.category.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.origin.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="px-6 pb-12">
      <div className="mb-8">
        <SectionTitle title="The Bazaar" subtitle="Mountain Marketplace" />
        
        {/* Search Bar - Permanent in Shop */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="text-zinc-400" size={20} />
          </div>
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Najjar, Gandour, etc..."
            className="w-full bg-white border border-zinc-100 rounded-3xl py-5 pl-14 pr-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lebanese-cedar/10 transition-all shadow-sm"
          />
        </div>

        {/* Improved Vertical Tabs for Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeFilter === cat.id ? 'bg-lebanese-cedar border-lebanese-cedar text-white shadow-lg' : 'bg-white border-zinc-100 text-zinc-400'}`}
            >
              <cat.icon size={14} />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{filteredProducts.length} Results</p>
      </div>

      {/* Optimized Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">
        <AnimatePresence>
          {filteredProducts.map((p) => (
            <motion.div 
              layout
              key={p.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col group"
            >
              <div 
                onClick={() => onProductClick(p)}
                className="aspect-[4/5] rounded-[32px] overflow-hidden bg-white relative mb-4 shadow-sm border border-zinc-50 cursor-pointer active:scale-95 transition-transform"
              >
                <ProductImage name={p.name} src={p.image} />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(p);
                  }}
                  className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md flex items-center justify-center text-lebanese-cedar shadow-sm active:scale-110 transition-transform"
                >
                  <ShoppingBag size={16} />
                </button>
              </div>
              <div className="space-y-1 px-1">
                <h4 className="text-sm font-serif text-lebanese-cedar line-clamp-1 leading-tight">{p.name}</h4>
                <p className="text-[8px] text-zinc-400 font-black uppercase tracking-[0.2em]">{p.origin}</p>
                <span className="block text-lebanese-gold font-display font-black text-md pt-0.5">${p.price}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredProducts.length === 0 && (
          <div className="col-span-2 py-20 text-center opacity-40">
            <Search className="mx-auto mb-4" size={48} strokeWidth={1} />
            <p className="font-serif italic text-lg">No treasures found...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Component: Modal ---
function ProductModal({ product, onClose, onAddToCart }: { product: Product, onClose: () => void, onAddToCart: (p: Product) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center px-0 md:px-6"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative bg-white w-full max-w-lg h-[90vh] rounded-t-[48px] overflow-hidden flex flex-col shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-zinc-400 shadow-sm">
          <X size={20} />
        </button>
        
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="relative h-[45vh]">
            <ProductImage name={product.name} src={product.image} />
            <div className="absolute top-8 left-8">
              <span className="bg-lebanese-gold text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{product.tag}</span>
            </div>
          </div>
          
          <div className="p-10 space-y-8">
            <div>
              <p className="text-lebanese-gold text-[10px] font-black uppercase tracking-[0.3em] mb-3">{product.category} • {product.origin}</p>
              <h2 className="text-4xl font-serif text-lebanese-cedar leading-tight">{product.name}</h2>
            </div>
            
            <p className="text-zinc-500 leading-relaxed font-light text-lg">
              {product.description}
            </p>
            
            <div className="space-y-4 pt-4 border-t border-zinc-100">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Price per Unit</span>
                <span className="text-3xl font-display font-bold text-lebanese-gold">${product.price}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-8 bg-zinc-50/50 border-t border-zinc-100">
          <button 
            onClick={() => onAddToCart(product)}
            className="w-full bg-lebanese-cedar text-white font-bold py-6 rounded-3xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <ShoppingBag size={24} />
            <span>Add to Cart</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- View: Cart ---
function CartView({ cart, onUpdateQty, onRemove, onCheckout }: { cart: CartItem[], onUpdateQty: (id: string, d: number) => void, onRemove: (id: string) => void, onCheckout: () => void }) {
  const total = cart.reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);

  if (cart.length === 0) {
    return (
      <div className="px-6 py-20 text-center space-y-8 relative overflow-hidden">
        {/* Decorative background motifs */}
        <div className="absolute top-10 left-10 text-lebanese-gold/10 -rotate-12">
          <Leaf size={120} />
        </div>
        <div className="absolute bottom-10 right-10 text-lebanese-gold/10 rotate-12">
          <Leaf size={120} />
        </div>
        
        <div className="relative z-10 w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto text-lebanese-gold shadow-xl border-4 border-lebanese-gold/10">
          <ShoppingBag size={56} strokeWidth={1} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-serif text-lebanese-cedar mb-3">Your Bazaar is Empty</h2>
          <p className="text-zinc-400 font-light max-w-[240px] mx-auto text-lg leading-relaxed">
            Fill your home with the authentic <span className="serif-italic text-lebanese-gold">Baladi</span> taste of Lebanon.
          </p>
        </div>
        <div className="relative z-10 pt-4">
          <div className="h-[1px] w-24 bg-lebanese-gold/30 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-40">
      <SectionTitle title="Your Selection" subtitle="Cart" />
      
      <div className="space-y-6 mb-12">
        {cart.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 bg-white rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
              <ProductImage name={item.name} src={item.image} />
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-serif text-lebanese-cedar">{item.name}</h4>
                <button onClick={() => onRemove(item.id)} className="text-zinc-300 p-1"><X size={16} /></button>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-lebanese-gold font-display font-bold text-sm">${item.price}</span>
                <div className="flex items-center gap-3 bg-zinc-100 px-3 py-1.5 rounded-xl text-zinc-500">
                  <button onClick={() => onUpdateQty(item.id, -1)} className="text-lg font-bold">-</button>
                  <span className="text-xs font-bold text-lebanese-cedar w-4 text-center">{item.quantity}</span>
                  <button onClick={() => onUpdateQty(item.id, 1)} className="text-lg font-bold">+</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-24 left-6 right-6 space-y-4">
        <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-zinc-100 space-y-6">
          <div className="flex justify-between items-center text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
            <span>Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center border-t pt-4">
            <span className="text-xl font-serif text-lebanese-cedar">Grand Total</span>
            <span className="text-2xl font-display font-bold text-lebanese-gold">${total.toFixed(2)}</span>
          </div>
          <button 
            onClick={onCheckout}
            className="w-full bg-lebanese-gold text-lebanese-cedar font-bold py-5 rounded-3xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <MessageCircle size={24} />
            <span>Checkout via WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- View: Story ---
// --- View: Admin ---
type AdminViewProps = {
  products: Product[];
  isAdmin: boolean;
  authLoading: boolean;
  adminCheckStatus: AdminCheckStatus;
  authError: string | null;
  user: User | null;
  isSigningIn: boolean;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSeed: () => void;
  onError: (message: string | null) => void;
};

function AdminView({
  products,
  isAdmin,
  authLoading,
  adminCheckStatus,
  authError,
  user,
  isSigningIn,
  onLogin,
  onLogout,
  onSeed,
  onError,
}: AdminViewProps) {
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (authLoading || adminCheckStatus === 'checking') {
    return (
      <div className="px-6 py-20 text-center">
        <Clock className="mx-auto mb-6 animate-spin text-lebanese-cedar opacity-40" size={56} />
        <h2 className="text-2xl font-serif text-lebanese-cedar mb-4">Checking Admin Access</h2>
        <p className="mx-auto max-w-md text-zinc-500">
          {user?.email
            ? `Signed in as ${user.email}. Verifying the admin role in Firestore...`
            : 'Checking the current Firebase sign-in session...'}
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-6 py-20 text-center">
        <Lock className="mx-auto mb-6 text-lebanese-cedar opacity-20" size={64} />
        <h2 className="text-2xl font-serif text-lebanese-cedar mb-4">Restricted Area</h2>
        <p className="mx-auto mb-6 max-w-md text-zinc-500">
          {user
            ? `You are signed in as ${user.email ?? user.uid}, but this account does not currently have admin access.`
            : 'Please login with an authorized Google account to access the bazaar management.'}
        </p>
        {authError && (
          <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-red-100 bg-red-50 p-4 text-left text-xs leading-relaxed text-red-700">
            {authError}
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onLogin}
            disabled={isSigningIn}
            className="bg-lebanese-cedar text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 disabled:cursor-wait disabled:opacity-60"
          >
            {isSigningIn ? <Clock size={20} className="animate-spin" /> : <LogIn size={20} />}
            <span>{isSigningIn ? 'Opening Google...' : 'Login with Google'}</span>
          </button>
          {user && (
            <button
              onClick={onLogout}
              className="bg-zinc-100 text-zinc-500 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3"
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setEditingProduct({ ...editingProduct, image: url });
    } catch (error) {
      const message = formatFirebaseError(error, 'Image upload failed');
      console.error(message, error);
      onError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingProduct?.name || !editingProduct?.price) return;
    setLoading(true);
    try {
      if (isNew) {
        await addDoc(collection(db, 'products'), editingProduct);
      } else if (editingProduct.id) {
        const { id, ...data } = editingProduct;
        await updateDoc(doc(db, 'products', id), data);
      }
      setEditingProduct(null);
    } catch (e) {
      const message = formatFirebaseError(e, 'Saving product failed');
      console.error(message, e);
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this treasure?")) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (e) {
      const message = formatFirebaseError(e, 'Deleting product failed');
      console.error(message, e);
      onError(message);
    }
  };

  return (
    <div className="px-6 pb-20">
      <div className="flex justify-between items-end mb-10">
        <SectionTitle title="Market Dashboard" subtitle="Manage Bazaar" />
        <div className="flex gap-2 mb-10">
          <button 
            onClick={() => {
              setEditingProduct({ name: '', price: '', category: 'Beverages', tag: 'New', origin: '', description: '', image: '' });
              setIsNew(true);
            }}
            className="bg-lebanese-cedar text-white p-4 rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            <Plus size={24} />
          </button>
          <button onClick={onLogout} className="bg-zinc-100 text-zinc-500 p-4 rounded-2xl active:scale-95 transition-all">
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {products.length === 0 && (
        <div className="bg-white p-10 rounded-[40px] text-center border-2 border-dashed border-zinc-100 mb-8">
          <p className="text-zinc-400 mb-6">Database is empty. Want to seed the initial 50 items?</p>
          <button onClick={onSeed} className="bg-lebanese-gold text-lebanese-cedar px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Seed Database</button>
        </div>
      )}

      <div className="space-y-4">
        {products.sort((a, b) => a.category.localeCompare(b.category)).map((p) => (
          <div key={p.id} className="bg-white p-4 rounded-3xl border border-zinc-100 flex items-center gap-4 group">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
              <ProductImage name={p.name} src={p.image} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-serif text-lebanese-cedar truncate">{p.name}</h4>
              <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">{p.category} • ${p.price}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setEditingProduct(p);
                  setIsNew(false);
                }}
                className="p-2 text-zinc-400 hover:text-lebanese-cedar transition-colors"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDelete(p.id)}
                className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Overlay */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-white w-full max-w-lg h-[85vh] rounded-t-[48px] overflow-hidden flex flex-col p-8 pt-12"
            >
               <button onClick={() => setEditingProduct(null)} className="absolute top-6 right-6 text-zinc-400">
                  <X size={24} />
               </button>
               <h3 className="text-2xl font-serif text-lebanese-cedar mb-8">{isNew ? 'Add New Treasure' : 'Refine Item'}</h3>
               
               <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-10">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Item Name</label>
                    <input 
                      value={editingProduct.name}
                      onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                      className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-lebanese-gold/20"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Price ($)</label>
                      <input 
                        value={editingProduct.price}
                        onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                        className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Category</label>
                      <select 
                        value={editingProduct.category}
                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                        className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm appearance-none"
                      >
                         {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Item Image</label>
                    <div className="flex flex-col gap-4">
                       <div 
                         onClick={() => fileInputRef.current?.click()}
                         className="relative w-full h-40 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center cursor-pointer group hover:border-lebanese-gold/50 transition-all overflow-hidden"
                       >
                          {editingProduct.image ? (
                            <>
                              <ProductImage name={editingProduct.name || 'Preview'} src={editingProduct.image} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Upload className="text-white" size={32} />
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="text-zinc-300 group-hover:text-lebanese-gold transition-colors" size={32} />
                              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-2">Upload Image</p>
                            </>
                          )}
                          {uploading && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                              <div className="w-8 h-8 border-4 border-lebanese-gold border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                       </div>
                       
                       <input 
                         type="file" 
                         ref={fileInputRef}
                         onChange={handleFileUpload}
                         accept="image/*"
                         className="hidden" 
                       />

                       <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-300">Or Image URL</label>
                        <input 
                          value={editingProduct.image}
                          onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                          placeholder="https://..."
                          className="w-full bg-zinc-100/50 border-none rounded-xl p-3 text-[10px]"
                        />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Origin / Brand</label>
                    <input 
                      value={editingProduct.origin}
                      onChange={e => setEditingProduct({...editingProduct, origin: e.target.value})}
                      className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tagline</label>
                    <input 
                      value={editingProduct.tag}
                      onChange={e => setEditingProduct({...editingProduct, tag: e.target.value})}
                      placeholder="Iconic, Fresh, Essential..."
                      className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</label>
                    <textarea 
                      rows={3}
                      value={editingProduct.description}
                      onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                      className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-sm resize-none"
                    />
                  </div>
               </div>

               <button 
                  disabled={loading}
                  onClick={handleSave}
                  className="w-full bg-lebanese-gold text-lebanese-cedar font-black py-6 rounded-3xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
               >
                  {loading ? <div className="w-5 h-5 border-2 border-lebanese-cedar border-t-transparent rounded-full animate-spin" /> : <Save size={24} />}
                  <span>{isNew ? 'Create Item' : 'Update Item'}</span>
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- View: Story ---
function StoryView() {
  return (
    <div className="px-6 pb-20 space-y-16">
      <header className="space-y-6">
        <SectionTitle title="Aramoun Heritage" subtitle="The Transit Story" />
        <div className="relative rounded-[56px] overflow-hidden aspect-[4/5] shadow-2xl">
          <HeroImage 
            name="Story Hero" 
            type="story" 
            label="Our Roots" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-lebanese-cedar/80 via-lebanese-cedar/20 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10">
            <p className="text-3xl font-serif text-white leading-tight">Since our first day in Aramoun, we knew quality couldn't be rushed.</p>
          </div>
        </div>
      </header>
      
      <div className="space-y-10">
        <div className="space-y-6 text-zinc-600 leading-relaxed font-light text-lg">
          <p>Transit Market was born from a simple observation: the best things in Lebanon stay in the villages. We wanted to create a "Transit" — a direct line from the artisans of the mountains to the families of Aramoun.</p>
          <div className="py-8 border-y border-zinc-100">
            <blockquote className="serif-italic text-2xl text-lebanese-cedar block text-center px-4">
              "We don't just sell food; we preserve the taste of home."
            </blockquote>
          </div>
          <p>Every jar of honey, every bottle of oil, and every crate of citrus is hand-vetted. If we wouldn't serve it to our own children, it doesn't make it to our bazaar.</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm text-center">
            <div className="text-4xl font-display font-medium text-lebanese-gold mb-2">100%</div>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Authentically Baladi</p>
          </div>
          <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm text-center">
            <div className="text-4xl font-display font-medium text-lebanese-gold mb-2">80+</div>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Local Artisans</p>
          </div>
        </div>
      </div>

      <div className="bg-lebanese-cedar rounded-[56px] p-12 text-white space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <h3 className="text-3xl font-serif leading-tight">Join us in supporting <br/><span className="text-lebanese-gold">Lebanese Farmers.</span></h3>
        <p className="text-emerald-50/60 font-light leading-relaxed">By shopping at Transit, you're directly contributing to the sustainability of small groves across the country.</p>
        <div className="flex items-center gap-4 text-lebanese-gold font-black uppercase text-xs tracking-widest pt-4">
          <span>Our Community</span>
          <ArrowRight size={16} />
        </div>
      </div>
    </div>
  );
}

// --- View: Contact ---
function ContactView() {
  return (
    <div className="px-6 pb-32 space-y-12">
      <SectionTitle title="Find Us in Aramoun" subtitle="Connect With Us" />
      
      <div className="grid grid-cols-1 gap-6">
        <a 
          href="tel:76425159" 
          className="bg-white px-8 py-7 rounded-[40px] border border-zinc-100 flex items-center justify-between shadow-xl shadow-zinc-200/30 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-lebanese-gold/10 flex items-center justify-center">
              <Phone className="text-lebanese-gold" size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Call Dispatch</p>
              <p className="text-xl font-display font-medium text-lebanese-cedar">76 425 159</p>
            </div>
          </div>
          <ChevronRight size={24} className="text-zinc-200" />
        </a>

        <a 
          href="https://wa.me/96176425159" 
          className="bg-white px-8 py-7 rounded-[40px] border border-zinc-100 flex items-center justify-between shadow-xl shadow-zinc-200/30 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-[#E7F9ED] flex items-center justify-center">
              <MessageCircle className="text-[#25D366]" size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">WhatsApp Chat</p>
              <p className="text-xl font-display font-medium text-lebanese-cedar">Live Support</p>
            </div>
          </div>
          <ChevronRight size={24} className="text-zinc-200" />
        </a>

        <a 
          href="https://instagram.com/transit_marketleb" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="bg-white px-8 py-7 rounded-[40px] border border-zinc-100 flex items-center justify-between shadow-xl shadow-zinc-200/30 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center">
              <Instagram className="text-pink-500" size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Instagram</p>
              <p className="text-xl font-display font-medium text-lebanese-cedar">@transit_marketleb</p>
            </div>
          </div>
          <ChevronRight size={24} className="text-zinc-200" />
        </a>

        <div className="bg-white rounded-[48px] border border-zinc-100 shadow-xl shadow-zinc-200/30 overflow-hidden">
          <div className="p-8 space-y-2 border-b border-zinc-50">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-lebanese-cedar/5 flex items-center justify-center">
                <MapPin className="text-lebanese-cedar" size={20} />
              </div>
              <h4 className="text-lg font-serif text-lebanese-cedar">Location</h4>
            </div>
            <p className="text-sm text-zinc-500 font-light">Main Road, Aramoun, Lebanon • Open daily 8 AM - 10 PM</p>
          </div>
          <div className="h-64 relative">
            <HeroImage name="Location Map" type="map" />
            <div className="absolute inset-0 bg-lebanese-cedar/10 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                <MapPin className="text-lebanese-gold" size={24} fill="currentColor" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
