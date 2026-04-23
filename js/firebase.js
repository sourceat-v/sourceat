// ============================================================
// $ourceat — firebase.js
// Firebase Firestore 댓글 관리
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, getDoc, increment } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHxYK5IRKualXGoz3cse-RdlbvrhybbD8",
  authDomain: "sourceat-f4c68.firebaseapp.com",
  projectId: "sourceat-f4c68",
  storageBucket: "sourceat-f4c68.firebasestorage.app",
  messagingSenderId: "404580150257",
  appId: "1:404580150257:web:22b504157c79a8f6873250"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── 트렌드 데이터 불러오기 ────────────────────────────────
export async function loadTrends() {
  try {
    const snap = await getDoc(doc(db, 'site_data', 'trends'));
    if (snap.exists()) return snap.data().data || null;
    return null;
  } catch(err) {
    console.error('트렌드 로드 실패:', err);
    return null;
  }
}

// ── 댓글 불러오기 ─────────────────────────────────────────
export async function loadComments(productId) {
  try {
    const q = query(
      collection(db, 'comments', productId, 'items'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id:        doc.id,
      ...doc.data(),
      time:      formatTime(doc.data().createdAt?.toDate()),
      userLiked: false,
    }));
  } catch(err) {
    console.error('댓글 로드 실패:', err);
    return [];
  }
}

// ── 댓글 저장 ─────────────────────────────────────────────
export async function saveComment(productId, author, text) {
  try {
    const docRef = await addDoc(
      collection(db, 'comments', productId, 'items'),
      {
        author,
        text,
        likes:     0,
        createdAt: serverTimestamp(),
        parentId:  null,
      }
    );
    return docRef.id;
  } catch(err) {
    console.error('댓글 저장 실패:', err);
    return null;
  }
}

// ── 답글 저장 ─────────────────────────────────────────────
export async function saveReply(productId, parentId, author, text) {
  try {
    const docRef = await addDoc(
      collection(db, 'comments', productId, 'items'),
      { author, text, likes: 0, createdAt: serverTimestamp(), parentId }
    );
    return docRef.id;
  } catch(err) {
    console.error('답글 저장 실패:', err);
    return null;
  }
}

// ── 좋아요 업데이트 ───────────────────────────────────────
export async function updateLike(productId, commentId, delta) {
  try {
    const ref = doc(db, 'comments', productId, 'items', commentId);
    await updateDoc(ref, { likes: increment(delta) });
  } catch(err) {
    console.error('좋아요 업데이트 실패:', err);
  }
}

// ── 시간 포맷 ─────────────────────────────────────────────
function formatTime(date) {
  if (!date) return 'Just now';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)                  return 'Just now';
  if (diff < 3600)                return `${Math.floor(diff/60)} min ago`;
  if (diff < 86400)               return `${Math.floor(diff/3600)} hours ago`;
  if (diff < 86400 * 7)           return `${Math.floor(diff/86400)} days ago`;
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
