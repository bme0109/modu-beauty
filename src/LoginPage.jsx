import { useState } from "react";

const P  = "#7C6BC4";
const PS = "#F5F3FC";
const G2 = "#EAE6F4";
const G5 = "#9E98B8";
const DK = "#221D40";
const WH = "#FFFFFF";
const RD = "#E05C5C";
const BG = "#F7F5FD";

function BrandLogo() {
  return (
    <div style={{
      width:68, height:68, borderRadius:22,
      background:"linear-gradient(135deg, #7C6BC4 0%, #A594E0 100%)",
      margin:"0 auto 16px",
      display:"flex", alignItems:"center", justifyContent:"center",
      boxShadow:"0 10px 30px #7C6BC455",
      position:"relative", overflow:"hidden",
    }}>
      <div style={{
        position:"absolute", width:54, height:54, borderRadius:"50%",
        border:"1.5px solid rgba(255,255,255,0.15)", top:7, left:7,
      }}/>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        {/* 브러시 손잡이 */}
        <rect x="16" y="2" width="4" height="15" rx="2" fill="rgba(255,255,255,0.95)"/>
        {/* 브러시 헤드 */}
        <ellipse cx="18" cy="19" rx="5.5" ry="3.5" fill="white"/>
        <ellipse cx="18" cy="22" rx="4" ry="2.2" fill="rgba(255,255,255,0.7)"/>
        {/* 스파클 */}
        <circle cx="8"  cy="10" r="1.3" fill="rgba(255,255,255,0.8)"/>
        <circle cx="28" cy="8"  r="1.0" fill="rgba(255,255,255,0.6)"/>
        <circle cx="29" cy="23" r="1.5" fill="rgba(255,255,255,0.75)"/>
        <circle cx="7"  cy="24" r="1.1" fill="rgba(255,255,255,0.6)"/>
        <line x1="8"  y1="7"  x2="8"  y2="13" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9"/>
        <line x1="5"  y1="10" x2="11" y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9"/>
        <line x1="29" y1="20" x2="29" y2="26" stroke="rgba(255,255,255,0.4)"  strokeWidth="0.9"/>
        <line x1="26" y1="23" x2="32" y2="23" stroke="rgba(255,255,255,0.4)"  strokeWidth="0.9"/>
        {/* 하단 도트 */}
        <circle cx="13" cy="29" r="1.3" fill="rgba(255,255,255,0.5)"/>
        <circle cx="18" cy="31" r="1.6" fill="rgba(255,255,255,0.65)"/>
        <circle cx="23" cy="29" r="1.3" fill="rgba(255,255,255,0.5)"/>
      </svg>
    </div>
  );
}

export default function LoginPage({ onLogin, onSignup }) {
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ shopName:"", email:"", password:"", confirm:"" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function set(k, v) { setForm(p => ({...p, [k]: v})); setError(""); }

  async function handleLogin(e) {
    e.preventDefault();
    if(!form.email || !form.password) { setError("이메일과 비밀번호를 입력하세요."); return; }
    setLoading(true);
    try { await onLogin(form.email, form.password); }
    catch { setError("이메일 또는 비밀번호가 올바르지 않아요."); }
    finally { setLoading(false); }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if(!form.shopName)            { setError("샵 이름을 입력하세요."); return; }
    if(!form.email)               { setError("이메일을 입력하세요."); return; }
    if(form.password.length < 6)  { setError("비밀번호는 6자 이상이어야 해요."); return; }
    if(form.password !== form.confirm) { setError("비밀번호가 일치하지 않아요."); return; }
    setLoading(true);
    try { await onSignup(form.shopName, form.email, form.password); }
    catch(err) { setError(err.message || "가입 중 오류가 발생했어요."); }
    finally { setLoading(false); }
  }

  async function handleReset(e) {
    e.preventDefault();
    if(!form.email) { setError("이메일을 입력하세요."); return; }
    setLoading(true);
    try { setResetSent(true); }
    catch { setError("이메일 발송에 실패했어요."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight:"100vh", background:BG,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"24px 20px",
      fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",
    }}>
      {/* 브랜드 */}
      <div style={{textAlign:"center", marginBottom:32}}>
        <BrandLogo/>
        <h1 style={{
          fontSize:26, fontWeight:900, color:P,
          margin:"0 0 5px", letterSpacing:1.5,
          background:"linear-gradient(180deg, #5A4BAD 0%, #C4B4F0 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          fontFamily:"Georgia,'Times New Roman',serif",
        }}>
          Modu Beauty
        </h1>
        <p style={{fontSize:13, color:"#9B8ED4", margin:"4px 0 2px", fontWeight:500, letterSpacing:2, marginBottom:10}}>
          모두의 뷰티
        </p>
      </div>

      {/* 카드 */}
      <div style={{
        width:"100%", maxWidth:400,
        background:WH, borderRadius:20,
        padding:"26px 24px",
        boxShadow:"0 4px 32px #7C6BC418",
        border:"1px solid "+G2,
      }}>
        {/* 탭 */}
        {mode !== "reset" && (
          <div style={{display:"flex", marginBottom:22, background:PS, borderRadius:12, padding:3}}>
            {[{k:"login",l:"로그인"},{k:"signup",l:"회원가입"}].map(t => (
              <button key={t.k} onClick={() => { setMode(t.k); setError(""); }}
                style={{
                  flex:1, padding:"9px", borderRadius:10, border:"none",
                  background:mode===t.k ? P : "transparent",
                  color:mode===t.k ? WH : G5,
                  fontSize:13, fontWeight:700, cursor:"pointer",
                }}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        {/* 재설정 완료 */}
        {mode==="reset" && resetSent ? (
          <div style={{textAlign:"center", padding:"16px 0"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"#E8F9EF",margin:"0 auto 14px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#03C75A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontSize:15,fontWeight:700,color:DK,marginBottom:8}}>이메일을 확인하세요</div>
            <div style={{fontSize:13,color:G5,lineHeight:1.6}}>{form.email}로<br/>비밀번호 재설정 링크를 보냈어요.</div>
            <button onClick={() => { setMode("login"); setResetSent(false); }}
              style={{marginTop:20,padding:"11px 24px",borderRadius:12,background:P,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              로그인으로 돌아가기
            </button>
          </div>
        ) : (
          <form onSubmit={mode==="login"?handleLogin:mode==="signup"?handleSignup:handleReset}>
            {mode==="signup" && (
              <Field label="샵 이름" type="text" value={form.shopName}
                onChange={v=>set("shopName",v)} placeholder="예: 루미 네일"/>
            )}
            <Field label="이메일" type="email" value={form.email}
              onChange={v=>set("email",v)} placeholder="example@email.com"/>
            {mode !== "reset" && (
              <Field label="비밀번호" type="password" value={form.password}
                onChange={v=>set("password",v)} placeholder="6자 이상"/>
            )}
            {mode==="signup" && (
              <Field label="비밀번호 확인" type="password" value={form.confirm}
                onChange={v=>set("confirm",v)} placeholder="비밀번호 재입력"/>
            )}
            {error && (
              <div style={{padding:"10px 12px",borderRadius:10,background:"#FFF0F0",
                border:"1px solid "+RD+"55",fontSize:12,color:RD,marginBottom:14}}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{
                width:"100%", padding:"14px", borderRadius:13,
                background:loading?"#D8D2EC":P, border:"none",
                color:loading?G5:WH, fontSize:14, fontWeight:700,
                cursor:loading?"default":"pointer",
                boxShadow:loading?"none":"0 4px 14px #7C6BC444",
              }}>
              {loading?"처리 중..."
               :mode==="login"?"로그인"
               :mode==="signup"?"가입하고 시작하기"
               :"재설정 링크 보내기"}
            </button>
            {mode==="login" && (
              <div style={{textAlign:"center",marginTop:14}}>
                <button type="button" onClick={()=>{setMode("reset");setError("");}}
                  style={{background:"none",border:"none",color:G5,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            )}
            {mode==="reset" && (
              <div style={{textAlign:"center",marginTop:14}}>
                <button type="button" onClick={()=>{setMode("login");setError("");}}
                  style={{background:"none",border:"none",color:G5,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
                  로그인으로 돌아가기
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      <p style={{fontSize:11,color:G5,marginTop:18,textAlign:"center",lineHeight:1.7}}>
        로그인하면 샵 데이터가 안전하게 저장돼요.<br/>
        © 2025 Modu Beauty
      </p>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#9E98B8",fontWeight:700,marginBottom:6,letterSpacing:0.3}}>
        {label}
      </div>
      <input type={type} value={value}
        onChange={e=>onChange(e.target.value)}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        placeholder={placeholder}
        style={{
          width:"100%", padding:"12px 14px", borderRadius:11,
          border:"1.5px solid "+(focused?"#7C6BC4":"#EAE6F4"),
          fontSize:14, outline:"none", color:"#221D40",
          background:"#FFFFFF", boxSizing:"border-box",
        }}
      />
    </div>
  );
}
