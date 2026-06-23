import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import LoginPage from "./LoginPage";
import BeautyApp from "./BeautyApp";

export default function Root() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // 로그인 상태 감지 - 새로고침해도 유지됨
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "modu_shops", user.uid));
          const shopName = snap.exists() ? snap.data().shopName : "Modu Beauty";
          setSession({ uid: user.uid, email: user.email, shopName });
        } catch {
          setSession({ uid: user.uid, email: user.email, shopName: "Modu Beauty" });
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleLogin(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function handleSignup(shopName, email, password) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "modu_shops", user.uid), {
      shopName,
      email,
      createdAt: new Date().toISOString(),
    });
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function handleChangePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("로그인 상태가 아닙니다.");
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  }

  // 초기 로딩 스플래시
  if (loading) {
    return (
      <div style={{
        minHeight:"100vh", background:"#7C6BC4",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <div style={{textAlign:"center"}}>
          <div style={{
            width:64, height:64, borderRadius:20,
            background:"rgba(255,255,255,0.2)",
            margin:"0 auto 14px",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect x="16" y="2" width="4" height="15" rx="2" fill="rgba(255,255,255,0.95)"/>
              <ellipse cx="18" cy="19" rx="5.5" ry="3.5" fill="white"/>
              <ellipse cx="18" cy="22" rx="4" ry="2.2" fill="rgba(255,255,255,0.7)"/>
              <circle cx="8" cy="10" r="1.3" fill="rgba(255,255,255,0.8)"/>
              <circle cx="28" cy="8" r="1.0" fill="rgba(255,255,255,0.6)"/>
              <circle cx="29" cy="23" r="1.5" fill="rgba(255,255,255,0.75)"/>
            </svg>
          </div>
          <p style={{
            color:"rgba(255,255,255,0.9)", fontSize:18,
            fontFamily:"Georgia,serif", letterSpacing:2, fontWeight:700,
          }}>Modu Beauty</p>
          <p style={{color:"rgba(255,255,255,0.6)", fontSize:12, marginTop:4}}>모두뷰티</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} onSignup={handleSignup} />;
  }

  return <BeautyApp session={session} onLogout={handleLogout} onChangePassword={handleChangePassword} />;
}
