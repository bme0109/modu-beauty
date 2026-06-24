import React, { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, setDoc, serverTimestamp, query, orderBy
} from "firebase/firestore";

let P = "#7C6BC4";
let PL = "#EDE8F8";
let PM = "#9B8ED4";
let PS = "#F5F3FC";
let BG = "#F7F5FD";
let G2 = "#EAE6F4";
let G3 = "#D8D2EC";
let G5 = "#9E98B8";
let G7 = "#524E6A";
let DK = "#221D40";
let WH = "#FFFFFF";
let RD = "#E05C5C";
let GR = "#03C75A";
let GRL = "#E8F9EF"; // GR 계열 연한 배경
let OB  = "#EFECF8"; // 비근무 시간 배경
let OS  = "#E5E1F2"; // 비근무 시간 담당자 교차
let OR  = "#F472B6"; // 결제완료 핑크 포인트
let ORL = "#FDF0F7"; // 결제완료 연한 핑크 배경

const LIGHT={P:"#7C6BC4",PL:"#EDE8F8",PM:"#9B8ED4",PS:"#F5F3FC",BG:"#F7F5FD",G2:"#EAE6F4",G3:"#D8D2EC",G5:"#9E98B8",G7:"#524E6A",DK:"#221D40",WH:"#FFFFFF",RD:"#E05C5C",GR:"#03C75A",GRL:"#E8F9EF",OB:"#EFECF8",OS:"#E5E1F2",OR:"#F472B6",ORL:"#FDF0F7"};
const DARK ={P:"#5DD4BE",PL:"#0E2628",PM:"#3AADA0",PS:"#112020",BG:"#0D1A1C",G2:"#1E3436",G3:"#253E40",G5:"#7BA8A4",G7:"#B0D4D0",DK:"#E8F5F4",WH:"#162628",RD:"#FF4D8D",GR:"#8B5CF6",GRL:"#1E1438",OB:"#0A1614",OS:"#081210",OR:"#FF4D8D",ORL:"#2A1020"};

function applyTheme(dark) {
  const t = dark ? DARK : LIGHT;
  P=t.P; PL=t.PL; PM=t.PM; PS=t.PS; BG=t.BG;
  G2=t.G2; G3=t.G3; G5=t.G5; G7=t.G7;
  DK=t.DK; WH=t.WH; RD=t.RD; GR=t.GR; GRL=t.GRL; OB=t.OB; OS=t.OS; OR=t.OR; ORL=t.ORL;
}

const _todayD = new Date();
const TODAY = _todayD.getFullYear() + "-" + String(_todayD.getMonth()+1).padStart(2,"0") + "-" + String(_todayD.getDate()).padStart(2,"0");
const SLOT_H = 26;

function fmtPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.slice(0,3) + "-" + d.slice(3);
  return d.slice(0,3) + "-" + d.slice(3,7) + "-" + d.slice(7);
}

const HOLS = {
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-09": "한글날",
  "2025-12-25": "크리스마스",
};

let SVCS = [
  { id:"nail", label:"네일", items:[
    {id:1,name:"젤네일 단색",mins:60,price:40000},
    {id:2,name:"젤네일 아트",mins:90,price:65000},
    {id:3,name:"이달의아트",mins:90,price:70000},
    {id:4,name:"제거+기본젤",mins:60,price:40000},
  ]},
  { id:"pedi", label:"패디", items:[
    {id:5,name:"패디큐어",mins:60,price:45000},
    {id:6,name:"발아트",mins:90,price:60000},
  ]},
  { id:"eye", label:"속눈썹", items:[
    {id:7,name:"속눈썹 연장",mins:90,price:80000},
    {id:8,name:"속눈썹 리터치",mins:60,price:50000},
  ]},
  { id:"wax", label:"왁싱", items:[
    {id:9,name:"다리왁싱",mins:60,price:60000},
    {id:10,name:"브라질리언",mins:60,price:70000},
  ]},
];

let CUSTS = [];

let BKS = [];

const WORK_START = 10; // 운영 시작
const WORK_END   = 20; // 운영 종료

function makeSlots(unit=30) {
  const slots = [];
  for(let h=9; h<=22; h++){
    for(let m=0; m<60; m+=unit){
      if(h===22 && m>0) break;
      slots.push(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));
    }
  }
  return slots;
}
// 기본 30분 슬롯 (TT 컴포넌트 내에서 slotUnit으로 재생성)
const SLOTS = makeSlots(30);

function isWorkHour(slot) {
  const h = Number(slot.split(":")[0]);
  const m = Number(slot.split(":")[1]);
  const totalMin = h * 60 + m;
  return totalMin >= WORK_START * 60 && totalMin < WORK_END * 60;
}

function timeIdx(t, unit=30) {
  const p = t.split(":");
  const totalMin = Number(p[0])*60 + Number(p[1]) - 9*60;
  return Math.floor(totalMin / unit);
}

function endTime(time, mins) {
  const p = time.split(":");
  const e = Number(p[0]) * 60 + Number(p[1]) + mins;
  return String(Math.floor(e/60)).padStart(2,"0")
    + ":" + String(e%60).padStart(2,"0");
}

// ── 공통 팝업 래퍼 ───────────────────────────────────────
// Claude.ai 환경: App 루트가 maxWidth:430 + margin:auto라서
// fixed 팝업도 같은 폭/위치 기준으로 맞춤
function Sheet({ onClose, children, maxH = "90vh", zIndex = 500 }) {
  return (
    <div style={{
      position:"fixed",
      // 뷰포트 전체를 딤으로 덮음
      top:0, left:0, right:0, bottom:0,
      zIndex,
      // 팝업을 가운데 정렬
      display:"flex",
      alignItems:"flex-end",
      justifyContent:"center",
    }}>
      {/* 딤 배경 */}
      <div onClick={onClose} style={{
        position:"absolute", inset:0,
        background:"rgba(20,16,50,0.4)",
      }}/>
      {/* 팝업 본체 - 뷰포트 전체 폭 사용, 최대 430 */}
      <div style={{
        position:"relative", zIndex:1,
        width:"100vw", maxWidth:430,
      }}>
        <div style={{
          background:WH,
          borderRadius:"20px 20px 0 0",
          width:"100%",
          boxSizing:"border-box",
          maxHeight:maxH,
          display:"flex",
          flexDirection:"column",
          overflow:"hidden",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SheetHandle({ title, onClose }) {
  return (
    <div style={{padding:"12px 18px 0", flexShrink:0}}>
      <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"0 auto 14px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
      </div>
    </div>
  );
}

// ── 공통 예약 수정 Sheet ──────────────────────────────
function EditBookingSheet({ editBk, setEditBk, staff, onSave, onClose, slotUnit=30 }) {
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showSvc, setShowSvc] = useState(false);

  const timeOpts = [];
  for(let h=9; h<=20; h++){
    for(let m=0; m<60; m+=slotUnit){
      if(h===20 && m>0) break;
      timeOpts.push(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));
    }
  }

  // 달력 날짜 생성 (현재 월 기준 ±1개월)
  const [calYr, setCalYr] = useState(() => Number((editBk.date||TODAY).slice(0,4)));
  const [calMo, setCalMo] = useState(() => Number((editBk.date||TODAY).slice(5,7)));
  const dim = new Date(calYr, calMo, 0).getDate();
  const fd  = new Date(calYr, calMo-1, 1).getDay();

  return (
    <Sheet onClose={onClose} maxH="92vh">
      <SheetHandle title="예약 수정" onClose={onClose}/>
      <div style={{flex:1,overflowY:"auto",padding:"0 18px 44px"}}>

        {/* 고객 */}
        <div style={{background:PL,borderRadius:12,padding:"11px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:P,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:WH}}>{editBk.name[0]}</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:DK}}>{editBk.name}</div>
            <div style={{fontSize:11,color:G5}}>현재 {editBk.date} {editBk.time}</div>
          </div>
        </div>

        {/* 담당자 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>담당자</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {staff.map(s => (
              <button key={s.id} onClick={() => setEditBk(p=>({...p,sid:s.id}))}
                style={{padding:"6px 14px",borderRadius:20,border:editBk.sid===s.id?"none":"1px solid "+G2,background:editBk.sid===s.id?P:WH,color:editBk.sid===s.id?WH:G7,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 + 예약 시간 - 한 줄 병렬 */}
        <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-start"}}>
          {/* 날짜 */}
          <div style={{flex:2}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>날짜</div>
            <button onClick={() => {setShowCal(v=>!v); setShowTime(false); setShowSvc(false);}}
              style={{width:"100%",padding:"11px 10px",borderRadius:10,border:"1.5px solid "+(showCal?P:G2),background:WH,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",boxSizing:"border-box"}}>
              <span style={{fontSize:12,fontWeight:600,color:DK}}>{editBk.date}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showCal?P:G5} strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            {showCal && (
              <div style={{marginTop:8,background:PS,borderRadius:12,padding:"12px 10px",border:"1px solid "+G2,position:"relative",zIndex:10}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <button onClick={() => {if(calMo===1){setCalMo(12);setCalYr(y=>y-1);}else setCalMo(m=>m-1);}}
                    style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 6px"}}>‹</button>
                  <span style={{fontSize:12,fontWeight:700,color:DK}}>{calYr}년 {calMo}월</span>
                  <button onClick={() => {if(calMo===12){setCalMo(1);setCalYr(y=>y+1);}else setCalMo(m=>m+1);}}
                    style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 6px"}}>›</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
                  {["일","월","화","수","목","금","토"].map((d,i)=>(
                    <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:i===0||i===6?RD:G5}}>{d}</div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                  {Array.from({length:fd}).map((_,i)=><div key={"e"+i}/>)}
                  {Array.from({length:dim},(_,i)=>{
                    const d = i+1;
                    const ds = calYr+"-"+String(calMo).padStart(2,"0")+"-"+String(d).padStart(2,"0");
                    const sel = editBk.date===ds;
                    const dow = (fd+i)%7;
                    return (
                      <div key={d} onClick={() => {setEditBk(p=>({...p,date:ds}));setShowCal(false);}}
                        style={{aspectRatio:"1",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:sel?P:"transparent",cursor:"pointer"}}>
                        <span style={{fontSize:12,fontWeight:sel?700:400,color:sel?WH:dow===0||dow===6?RD:G7}}>{d}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 예약 시간 */}
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>시간</div>
            <button onClick={() => {setShowTime(v=>!v); setShowCal(false); setShowSvc(false);}}
              style={{width:"100%",padding:"11px 10px",borderRadius:10,border:"1.5px solid "+(showTime?P:G2),background:WH,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",boxSizing:"border-box"}}>
              <span style={{fontSize:12,fontWeight:600,color:DK}}>{editBk.time}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showTime?P:G5} strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </button>
            {showTime && (
              <div style={{marginTop:8,background:PS,borderRadius:12,padding:"10px",border:"1px solid "+G2,maxHeight:180,overflowY:"auto",position:"relative",zIndex:10}}>
                {timeOpts.map(t => (
                  <div key={t} onClick={() => {setEditBk(p=>({...p,time:t}));setShowTime(false);}}
                    style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",background:editBk.time===t?P:"transparent",marginBottom:2}}>
                    <span style={{fontSize:12,fontWeight:editBk.time===t?700:400,color:editBk.time===t?WH:DK}}>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 시술명 + 소요시간 */}
        <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-start"}}>
          <div style={{flex:2,minWidth:0}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>시술명</div>
            <button onClick={() => {setShowSvc(v=>!v); setShowCal(false); setShowTime(false);}}
              style={{width:"100%",padding:"11px 12px",borderRadius:10,border:"1.5px solid "+(showSvc?P:G2),background:WH,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",boxSizing:"border-box"}}>
              <span style={{fontSize:12,fontWeight:600,color:editBk.svc?DK:G5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{editBk.svc||"시술 선택"}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={showSvc?P:G5} strokeWidth="2.5" style={{flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showSvc && (
              <div style={{marginTop:6,background:PS,borderRadius:12,padding:"8px",border:"1px solid "+G2,maxHeight:200,overflowY:"auto"}}>
                <input
                  value={editBk.svc}
                  onChange={e => setEditBk(p=>({...p,svc:e.target.value}))}
                  placeholder="직접 입력..."
                  style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box",marginBottom:6}}
                />
                {SVCS.flatMap(cat => cat.items).map(s => (
                  <div key={s.id} onClick={() => {setEditBk(p=>({...p,svc:s.name,mins:s.mins,price:s.price})); setShowSvc(false);}}
                    style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",background:editBk.svc===s.name?P:"transparent",marginBottom:2}}>
                    <span style={{fontSize:12,fontWeight:editBk.svc===s.name?700:400,color:editBk.svc===s.name?WH:DK}}>{s.name}</span>
                    <span style={{fontSize:11,color:editBk.svc===s.name?"rgba(255,255,255,0.7)":G5,marginLeft:8}}>{s.price.toLocaleString()}원 · {s.mins}분</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>소요시간</div>
            <select value={editBk.mins} onChange={e=>setEditBk(p=>({...p,mins:Number(e.target.value)}))}
              style={{width:"100%",padding:"11px 10px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,fontWeight:600,color:DK,background:WH,outline:"none",cursor:"pointer",appearance:"auto",boxSizing:"border-box"}}>
              {[30,45,60,75,90,120,150,180].map(m=><option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>

        {/* 시술 금액 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>시술 금액</div>
          <input value={editBk.price} onChange={e => setEditBk(p=>({...p,price:Number(e.target.value)||0}))}
            type="number"
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
        </div>

        {/* 메모 */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>메모</div>
          <input value={editBk.memo||""} onChange={e => setEditBk(p=>({...p,memo:e.target.value}))}
            placeholder="특이사항"
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
        </div>

        <button onClick={onSave}
          style={{width:"100%",padding:"14px",borderRadius:14,background:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 5px 16px "+P+"44"}}>
          수정 완료
        </button>
      </div>
    </Sheet>
  );
}

// ── 선불권 충전 공통 폼 (모든 충전 창에서 동일하게 사용) ──
// 충전금액 + 결제수단 + 보너스 수기입력 → 총 적립금액 표시
function PrepaidChargeForm({ amount, setAmount, chargeMethod, setChargeMethod, bonusInput, setBonusInput, memo, setMemo, onConfirm, confirmLabel, confirmActive }) {
  const amt = Number(amount) || 0;
  const bonus = Number(bonusInput) || 0;
  const total = amt + bonus;

  const methods = [
    {v:"card",    l:"카드",    bg:"#EEE8FB", ac:"#9B7EDF", tx:"#5933B5"},
    {v:"cash",    l:"현금",    bg:"#FFF0E8", ac:"#F4976C", tx:"#C0572A"},
    {v:"naverpay",l:"N페이",  bg:"#E5F8F1", ac:"#5DC4A2", tx:"#2D8A62"},
    {v:"transfer",l:"계좌이체",bg:"#E7F4FB", ac:"#6AB8D6", tx:"#2878A0"},
  ];

  return (
    <>
      {/* 충전 금액 */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:7}}>충전 금액</div>
        <div style={{display:"flex",alignItems:"center",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+P,background:WH,marginBottom:8}}>
          <span style={{flex:1,fontSize:22,fontWeight:800,color:DK}}>{amt.toLocaleString()}</span>
          <span style={{fontSize:14,color:G5}}>원</span>
          {amount && <button onClick={() => setAmount("")} style={{marginLeft:8,background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 4px"}}>×</button>}
        </div>
        <div style={{display:"flex",gap:7}}>
          {[50000,100000,200000,300000].map(v => (
            <button key={v} onClick={() => setAmount(String(amt + v))}
              style={{flex:1,padding:"9px 2px",borderRadius:10,border:"1.5px solid "+P,background:PL,color:P,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              +{v/10000}만
            </button>
          ))}
        </div>
      </div>

      {/* 결제수단 */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:7}}>결제수단</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7}}>
          {methods.map(o => {
            const sel = chargeMethod === o.v;
            return (
              <button key={o.v} onClick={() => setChargeMethod(o.v)}
                style={{padding:"9px 2px",borderRadius:10,border:sel?"none":"1px solid "+G2,background:sel?o.ac:o.bg,color:sel?WH:o.tx,fontSize:10,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* 보너스 적립금 수기 입력 */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:7}}>보너스 적립금 <span style={{color:G5,fontWeight:400}}>(수기 입력)</span></div>
        <div style={{display:"flex",alignItems:"center",padding:"10px 14px",borderRadius:12,border:"1.5px solid "+(bonus>0?GR:G2),background:bonus>0?"#F0FFF4":WH}}>
          <span style={{fontSize:13,color:G5,marginRight:6}}>+</span>
          <input
            value={bonusInput||""}
            onChange={e => setBonusInput(e.target.value)}
            type="number"
            placeholder="0"
            style={{flex:1,border:"none",background:"transparent",fontSize:18,fontWeight:700,color:bonus>0?GR:DK,outline:"none"}}
          />
          <span style={{fontSize:13,color:G5}}>원</span>
        </div>
        {bonus > 0 && (
          <div style={{fontSize:11,color:GR,marginTop:5,fontWeight:600}}>
            보너스 {bonus.toLocaleString()}원 추가 적립
          </div>
        )}
      </div>

      {/* 총 적립금액 요약 */}
      {amt > 0 && (
        <div style={{marginBottom:14,borderRadius:13,border:"1.5px solid "+PM,overflow:"hidden"}}>
          <div style={{background:PM,padding:"8px 14px"}}>
            <span style={{fontSize:11,fontWeight:700,color:WH}}>선불권 적립 내역</span>
          </div>
          <div style={{padding:"12px 14px",background:PS}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,color:G7}}>충전금액</span>
              <span style={{fontSize:13,fontWeight:600,color:DK}}>{amt.toLocaleString()}원</span>
            </div>
            {bonus > 0 && (
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,color:G7}}>보너스</span>
                <span style={{fontSize:13,fontWeight:600,color:GR}}>+{bonus.toLocaleString()}원</span>
              </div>
            )}
            <div style={{height:1,background:G3,margin:"6px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:DK}}>총 적립 선불권</span>
              <span style={{fontSize:18,fontWeight:800,color:P}}>{total.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      )}

      {/* 메모 */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:6}}>메모</div>
        <input value={memo||""} onChange={e => setMemo(e.target.value)} placeholder="충전 메모 (선택)"
          style={{width:"100%",padding:"11px 14px",borderRadius:11,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
      </div>

      <button onClick={onConfirm}
        style={{width:"100%",padding:"14px",borderRadius:14,background:confirmActive?P:G3,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer",
          boxShadow:confirmActive?"0 4px 14px "+P+"44":"none"}}>
        {confirmLabel}
      </button>
    </>
  );
}

function Badge({ dep }) {
  return (
    <span style={{display:"flex",gap:3,alignItems:"center"}}>
      {(dep === "naver_paid" || dep === "naver") && (
        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:4,background:GRL,border:"1px solid "+GR,fontSize:9,fontWeight:800,color:GR}}>N</span>
      )}
      {(dep === "naver_paid" || dep === "paid") && (
        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:4,background:PL,border:"1px solid "+PM,fontSize:8,fontWeight:800,color:P}}>예</span>
      )}
      {dep === "unpaid" && (
        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:4,background:"#FDEAEA",border:"1px solid "+RD,fontSize:8,fontWeight:800,color:RD}}>미</span>
      )}
    </span>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"6px 13px", borderRadius:20,
      border: on ? "none" : "1px solid "+G2,
      background: on ? P : WH,
      color: on ? WH : G7,
      fontSize:12, fontWeight:600, cursor:"pointer",
    }}>{children}</button>
  );
}

// ── 시술 선택 팝업 ────────────────────────────────────
function SvcModal({ onSelect, onClose }) {
  const [tab, setTab] = useState("nail");
  const [xn, setXn] = useState("");
  const [xm, setXm] = useState(60);
  const [xp, setXp] = useState("");
  const cat = SVCS.find(c => c.id === tab);

  function addCustom() {
    if (!xn.trim()) return;
    onSelect({ id: Date.now(), name: xn.trim(), mins: xm, price: Number(xp)||0 });
    onClose();
  }

  return (
    <Sheet onClose={onClose} maxH="75vh">
      <div style={{padding:"12px 18px 0",flexShrink:0}}>
        <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"0 auto 14px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <span style={{fontSize:15,fontWeight:800,color:DK}}>시술 선택</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
        </div>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:10}}>
          {SVCS.map(s => <Pill key={s.id} on={tab===s.id} onClick={() => setTab(s.id)}>{s.label}</Pill>)}
          <Pill on={tab==="custom"} onClick={() => setTab("custom")}>직접추가</Pill>
        </div>
      </div>
      <div style={{height:1,background:G2}}/>
      <div style={{flex:1,overflowY:"auto",padding:"0 18px"}}>
        {tab !== "custom" && cat && cat.items.map(s => (
          <div key={s.id} onClick={() => { onSelect(s); onClose(); }}
            style={{display:"flex",alignItems:"center",padding:"14px 0",borderBottom:"1px solid "+G2,cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:4,border:"2px solid "+G3,marginRight:12,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:DK}}>{s.name}</div>
              <div style={{fontSize:11,color:G5}}>{s.price.toLocaleString()}원 · {s.mins}분</div>
            </div>
          </div>
        ))}
        {tab === "custom" && (
          <div style={{paddingTop:14}}>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G5,marginBottom:5}}>이름</div>
              <input value={xn} onChange={e => setXn(e.target.value)} placeholder="시술명"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:14,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid "+G2}}>
              <span style={{fontSize:13,color:G7}}>시간</span>
              <select value={xm} onChange={e => setXm(Number(e.target.value))}
                style={{border:"none",background:"transparent",fontSize:14,fontWeight:700,color:DK,outline:"none"}}>
                {[30,60,90,120,150,180].map(m => <option key={m} value={m}>{m}분</option>)}
              </select>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid "+G2}}>
              <span style={{fontSize:13,color:G7}}>가격</span>
              <input value={xp} onChange={e => setXp(e.target.value)} type="number" placeholder="0"
                style={{border:"none",background:"transparent",fontSize:14,fontWeight:700,color:DK,outline:"none",textAlign:"right",width:80}}/>
            </div>
            <button onClick={addCustom}
              style={{width:"100%",padding:"13px",borderRadius:14,background:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:16}}>추가</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ── 고객 팝업 ─────────────────────────────────────────
function CustModal({ onSelect, onClose, onSaveNew }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("search");
  const [nc, setNc] = useState({name:"",phone:"",birth:"",memo:"",tags:[]});
  const [tags, setTags] = useState(["VIP","단골","예약금 필수","노쇼 주의","손톱 얇음","큐티클 예민","왼손잡이","다한증"]);
  const [ct, setCt] = useState("");

  const filtered = CUSTS.filter(c =>
    c.name.includes(q) || c.phone.replace(/-/g,"").includes(q.replace(/-/g,""))
  );

  function togTag(t) {
    setNc(p => ({...p, tags: p.tags.includes(t) ? p.tags.filter(x=>x!==t) : [...p.tags,t]}));
  }
  function addTag() {
    const t = ct.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags(p => [...p,t]);
    setNc(p => ({...p, tags: p.tags.includes(t) ? p.tags : [...p.tags,t]}));
    setCt("");
  }
  function reg() {
    if (!nc.name.trim()) return;
    const c = { id: Date.now(), ...nc, visits:0, revenue:0 };
    CUSTS = [...CUSTS, c];
    if(onSaveNew) onSaveNew(c);
    onSelect(c);
  }

  return (
    <Sheet onClose={onClose} maxH="88vh">
      <div style={{padding:"12px 18px 0",flexShrink:0}}>
        <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"0 auto 14px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <span style={{fontSize:15,fontWeight:800,color:DK}}>고객</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {[{id:"search",l:"검색"},{id:"reg",l:"신규 등록"}].map(t => (
            <Pill key={t.id} on={mode===t.id} onClick={() => setMode(t.id)}>{t.l}</Pill>
          ))}
        </div>
      </div>
      {mode === "search" && (
        <div style={{flex:1,overflowY:"auto",padding:"0 18px 20px"}}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름 또는 전화번호 뒤 4자리"
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box",marginBottom:10}}/>
          {filtered.map(c => {
            const cBks = BKS.filter(b => b.name === c.name);
            const noshowCnt = cBks.filter(b => b.status === "noshow").length;
            const cancelCnt = cBks.filter(b => b.status === "cancel").length;
            return (
              <div key={c.id} onClick={() => onSelect(c)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:"1px solid "+G2,cursor:"pointer"}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:P,flexShrink:0}}>{c.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:DK,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    <span>{c.name}{c.phone&&<span style={{fontSize:11,fontWeight:400,color:G5}}> ···{c.phone.replace(/-/g,"").slice(-4)}</span>}</span>
                    {noshowCnt>0 && <span style={{fontSize:10,fontWeight:700,color:RD,background:RD+"18",borderRadius:5,padding:"2px 6px",flexShrink:0}}>노쇼 {noshowCnt}회</span>}
                    {cancelCnt>0 && <span style={{fontSize:10,fontWeight:700,color:G5,background:G3,borderRadius:5,padding:"2px 6px",flexShrink:0}}>취소 {cancelCnt}회</span>}
                  </div>
                  <div style={{fontSize:11,color:G5}}>{c.phone} · {c.visits}회</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {mode === "reg" && (
        <div style={{flex:1,overflowY:"auto",padding:"0 18px 20px",WebkitOverflowScrolling:"touch"}}>
          {[{l:"이름 *",k:"name",p:"홍길동",t:"text"},{l:"전화번호",k:"phone",p:"010-0000-0000",t:"tel"},{l:"생년월일",k:"birth",p:"1990-01-01",t:"text"}].map(f => (
            <div key={f.k} style={{marginBottom:11}}>
              <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:4}}>{f.l}</div>
              <input value={nc[f.k]} onChange={e => setNc(p => ({...p,[f.k]:f.k==="phone"?fmtPhone(e.target.value):e.target.value}))}
                placeholder={f.p} type={f.t}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
          ))}
          <div style={{marginBottom:11}}>
            <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:7}}>태그</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
              {tags.map(t => <Pill key={t} on={nc.tags.includes(t)} onClick={() => togTag(t)}>{t}</Pill>)}
            </div>
            <div style={{display:"flex",gap:6}}>
              <input value={ct} onChange={e => setCt(e.target.value)} onKeyDown={e => {if(e.key==="Enter"){e.preventDefault();addTag();}}} placeholder="특이사항 직접 추가"
                style={{flex:1,padding:"8px 10px",borderRadius:9,border:"1.5px dashed "+PM,fontSize:11,outline:"none",color:DK,background:WH}}/>
              <button onMouseDown={e => {e.preventDefault();addTag();}}
                style={{padding:"8px 12px",borderRadius:9,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer"}}>추가</button>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:4}}>메모</div>
            <textarea value={nc.memo} onChange={e => setNc(p => ({...p,memo:e.target.value}))} placeholder="특이사항" rows={2}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,resize:"none",background:WH,boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
          <button onMouseDown={e => {e.preventDefault();reg();}}
            style={{width:"100%",padding:"13px",borderRadius:14,background:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer"}}>등록 완료</button>
        </div>
      )}
    </Sheet>
  );
}

// ── 예약 등록 팝업 (예약금 금액 입력 추가) ──────────────
function BookModal({ initTime, initSid, initDate, onClose, staff, onAddStaff, slotUnit=30, onSave, onSaveNewCust }) {
  const [f, setF] = useState({
    sid: initSid !== null && initSid !== undefined ? String(initSid) : "0",
    cid:"", name:"", phone:"",
    date: initDate || TODAY,
    time: initTime || "10:00",
    svc:"", mins:"60", svcPrice:"",
    dep:"", depAmt:"",   // depAmt: 예약금 실제 금액
    memo:"", tags:[],
  });
  const [showD, setShowD] = useState(false);
  const [showT, setShowT] = useState(false);
  const [showS, setShowS] = useState(false);
  const [showC, setShowC] = useState(false);
  const [ct, setCt] = useState("");
  const [tagList, setTagList] = useState(["VIP","단골","예약금 필수","노쇼 주의","손톱 얇음","큐티클 예민"]);
  const [showNaverPaste, setShowNaverPaste] = useState(false);
  const [naverText, setNaverText] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(null);
  const imgRef = useRef(null);
  const [dupCust, setDupCust] = useState(null);

  function set(k, v) { setF(p => ({...p, [k]: v})); }
  function togTag(t) { setF(p => ({...p, tags: p.tags.includes(t) ? p.tags.filter(x=>x!==t) : [...p.tags,t]})); }
  function addTag() {
    const t = ct.trim();
    if (!t) return;
    if (!tagList.includes(t)) setTagList(p => [...p,t]);
    setF(p => ({...p, tags: p.tags.includes(t) ? p.tags : [...p.tags,t]}));
    setCt("");
  }
  function applyNaverPaste(txtArg) {
    const txt = txtArg !== undefined ? txtArg : naverText;
    const ANNOUNCE_P = ['예약 변경 및 취소 안내','네이버 예약 시간 변동 안내'];
    const lines = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    // 이름: "예약자명 심문경" 형식
    const nameM = txt.match(/예약자명?[\s\t:]+([^\n\t]+)/);
    // 전화번호: 레이블 or 직접 패턴
    const phoneM = txt.match(/전화번호[\s\t:]+([\d\-]+)/) || txt.match(/(010-\d{4}-\d{4})/);
    // 날짜: 이용일시 레이블 없어도 패턴 직접 탐색
    const dtM = txt.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\([가-힣]+\)\s*(오전|오후)\s+(\d{1,2}):(\d{2})/);
    // 실제 결제금액 (상세보기: 예약금 결제정보 > 결제금액)
    const payAmtM = txt.match(/결제금액[\s\t:]*([\d,]+)원/);
    // 선택메뉴 총액 (톡톡: 시술 금액, 예약금 아님)
    const totalM = txt.match(/총\s*([\d,]+)원/);
    // 선택메뉴 섹션 - 멀티라인 방식
    const mi = lines.findIndex(l=>l.startsWith('선택메뉴'));
    let svcName="", svcAmt="";
    if(mi>=0){
      for(const line of lines.slice(mi+1)){
        if(/^총\s/.test(line)) continue;
        if(ANNOUNCE_P.some(a=>line.includes(a))) continue;
        const pm = line.match(/^(.+?)\s+([\d,]+)원$/);
        if(pm){ svcName=pm[1].trim(); svcAmt=pm[2].replace(/,/g,''); break; }
      }
    }
    // 선택메뉴가 한 줄에 모여 있는 경우 (" + "로 구분)
    if(!svcName && mi>=0){
      const inline = lines[mi].replace(/^선택메뉴[\s\t]*/,'').replace(/총\s*[\d,]+원/g,'');
      const inlineParts = inline.split(' + ').map(s=>s.trim()).filter(s=>s && !ANNOUNCE_P.some(a=>s.includes(a)));
      for(const p of inlineParts){
        const pm = p.match(/^(.+?)\s+([\d,]+)원$/);
        if(pm){ svcName=pm[1].trim(); svcAmt=pm[2].replace(/,/g,''); break; }
      }
    }
    // 매장방문결제/선결제 필드 (상세보기 형식, 네이버페이는 결제수단이라 제외)
    if(!svcName){
      const payLineM = txt.match(/(?:매장방문결제|선결제)[\s\t:]+(.+)/);
      if(payLineM){
        const parts = payLineM[1].split('+').map(s=>s.trim())
          .filter(s=>s && !ANNOUNCE_P.some(a=>s.includes(a)))
          .map(s=>s.replace(/\s+\d+$/, '').trim()); // 수량 숫자 제거 ("젤제거+기본케어 1" → "젤제거+기본케어")
        if(parts.length>0) svcName = parts.filter(Boolean).join(', ');
      }
    }
    // 앞의 "+ " 제거 (멀티라인 복사 시 마지막 항목 앞에 붙음)
    if(svcName.startsWith('+ ')) svcName = svcName.slice(2).trim();
    else if(svcName.startsWith('+')) svcName = svcName.slice(1).trim();
    const upd = {};
    if(nameM) upd.name = nameM[1].trim();
    // 레이블 없이 이름 값만 복사한 경우: 전화번호 이전 줄에서 한글 이름 탐색
    if(!upd.name){
      const phoneIdx = lines.findIndex(l=>/^010-/.test(l) || /^전화번호/.test(l));
      if(phoneIdx > 0){
        for(let i=phoneIdx-1; i>=Math.max(0,phoneIdx-3); i--){
          if(/^[가-힣]{2,5}$/.test(lines[i])){ upd.name=lines[i]; break; }
        }
      }
    }
    if(phoneM) upd.phone = phoneM[1].trim();
    if(dtM){
      const [,yr,mo,dy,ap,hS,mS] = dtM;
      upd.date = `${yr}-${mo.padStart(2,'0')}-${dy.padStart(2,'0')}`;
      let h = Number(hS);
      if(ap==='오후' && h<12) h+=12;
      if(ap==='오전' && h===12) h=0;
      upd.time = String(h).padStart(2,"0")+":"+mS;
    }
    if(svcName) upd.svc = svcName;
    if(svcAmt)  upd.svcPrice = svcAmt;
    // 시술 금액: 선택메뉴 총액(톡톡) or 서비스 항목 금액
    if(totalM && !upd.svcPrice) upd.svcPrice = totalM[1].replace(/,/g,'');
    if(txt.includes('결제완료')){
      upd.dep='naver_paid';
      // 예약금: 상세보기의 결제금액 우선, 없으면 빈값 (총액은 시술가격이지 예약금이 아님)
      if(payAmtM) upd.depAmt = payAmtM[1].replace(/,/g,'');
    } else if(txt.includes('매장방문결제')) {
      upd.dep='naver';
    } else {
      upd.dep='naver_paid';
    }
    if(upd.name || upd.phone){
      const exPhone = CUSTS.find(c=>c.phone && upd.phone && c.phone.replace(/-/g,"")===upd.phone.replace(/-/g,""));
      if(exPhone){
        upd.cid = String(exPhone.id);
      } else {
        const exName = upd.name && CUSTS.find(c=>c.name===upd.name);
        if(exName){
          setF(p=>({...p,...upd}));
          setNaverText("");
          setShowNaverPaste(false);
          setDupCust(exName);
          return;
        } else if(upd.name){
          const newC = {id:Date.now(), name:upd.name, phone:upd.phone||"", birth:"", memo:"", tags:[], visits:0, revenue:0};
          CUSTS = [...CUSTS, newC];
          if(onSaveNewCust) onSaveNewCust(newC);
          upd.cid = String(newC.id);
        }
      }
    }
    setF(p=>({...p,...upd}));
    setNaverText("");
    setShowNaverPaste(false);
  }

  async function applyImageOcr(file) {
    setImgLoading(true);
    setImgError(null);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("kor");
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      if (!text.trim()) {
        setImgError("텍스트를 인식하지 못했습니다");
        return;
      }
      applyNaverPaste(text);
    } catch {
      setImgError("이미지 인식 실패");
    }
    setImgLoading(false);
  }

  const _bToday = new Date();
  const _bYr = _bToday.getFullYear(), _bMo = _bToday.getMonth()+1;
  const _bDim = new Date(_bYr, _bMo, 0).getDate();
  const calDays = [];
  for (let i = 1; i <= _bDim; i++) {
    const ds = _bYr+"-"+String(_bMo).padStart(2,"0")+"-"+String(i).padStart(2,"0");
    const dow = new Date(_bYr, _bMo-1, i).getDay();
    calDays.push({d:i, ds, we: dow===0||dow===6});
  }

  const timeOpts = [];
  for(let h=9; h<=20; h++){
    for(let m=0; m<60; m+=slotUnit){
      if(h===20 && m>0) break;
      timeOpts.push(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));
    }
  }

  const payOpts = [
    {v:"naver_paid",l:"N결제",  bg:"#E5F8F1", ac:"#5DC4A2", tx:"#2D8A62"},
    {v:"transfer",  l:"계좌이체",bg:"#E7F4FB", ac:"#6AB8D6", tx:"#2878A0"},
    {v:"cash",      l:"현금",   bg:"#FFF0E8", ac:"#F4976C", tx:"#C0572A"},
    {v:"etc",       l:"기타",   bg:"#F0EEF8", ac:"#9890C5", tx:"#504888"},
  ];

  return (
    <>
      <Sheet onClose={onClose} maxH="90vh">
        <div style={{overflowY:"auto",flex:1,padding:"0 18px 44px"}}>
          <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"12px auto 16px"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showNaverPaste?10:18}}>
            <span style={{fontSize:16,fontWeight:800,color:DK}}>예약 등록</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>setShowNaverPaste(v=>!v)}
                style={{padding:"5px 11px",borderRadius:9,background:"#E8F9EE",border:"1px solid #03C75A",color:"#009444",fontSize:11,fontWeight:700,cursor:"pointer"}}>N예약</button>
              <button onClick={()=>imgRef.current?.click()} disabled={imgLoading}
                style={{padding:"5px 11px",borderRadius:9,background:PL,border:"1px solid "+PM,color:P,fontSize:11,fontWeight:700,cursor:"pointer",opacity:imgLoading?0.6:1}}>
                {imgLoading?"인식중…":"사진"}
              </button>
              <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}}
                onChange={e=>{const f=e.target.files?.[0];if(f)applyImageOcr(f);e.target.value="";}}/>
              <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
            </div>
          </div>
          {showNaverPaste && (
            <div style={{marginBottom:14,background:OB,borderRadius:12,padding:"12px"}}>
              <textarea value={naverText} onChange={e=>setNaverText(e.target.value)}
                placeholder="네이버 톡톡 예약 메시지를 붙여넣으세요"
                rows={5}
                style={{width:"100%",border:"1.5px solid #03C75A",borderRadius:9,padding:"9px 11px",fontSize:12,color:DK,background:WH,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
              <button onClick={()=>applyNaverPaste()}
                style={{width:"100%",marginTop:8,padding:"10px",borderRadius:10,background:"#03C75A",border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>적용</button>
            </div>
          )}
          {imgError && (
            <div style={{marginBottom:12,padding:"9px 12px",borderRadius:9,background:"#FFF0F0",border:"1px solid "+RD+"50",color:RD,fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{imgError}</span>
              <button onClick={()=>setImgError(null)} style={{background:"none",border:"none",cursor:"pointer",color:RD,fontSize:16,lineHeight:1}}>×</button>
            </div>
          )}

          {/* 담당자 */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>담당자</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {staff.map(s => <Pill key={s.id} on={f.sid===String(s.id)} onClick={() => set("sid",String(s.id))}>{s.name}</Pill>)}
              <button onMouseDown={e => {e.preventDefault();onAddStaff();}}
                style={{padding:"6px 12px",borderRadius:20,border:"1.5px dashed "+PM,background:WH,color:PM,fontSize:11,fontWeight:600,cursor:"pointer"}}>+ 추가</button>
            </div>
          </div>

          {/* 고객 */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>고객</div>
            {f.cid ? (
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"1.5px solid "+P,background:PL}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:P,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:WH,flexShrink:0}}>{f.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:DK,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    <span>{f.name}</span>
                    {(()=>{const n=BKS.filter(b=>b.name===f.name&&b.status==="noshow").length;return n>0&&<span style={{fontSize:10,fontWeight:700,color:RD,background:RD+"18",borderRadius:5,padding:"2px 6px"}}>노쇼 {n}회</span>})()}
                    {(()=>{const n=BKS.filter(b=>b.name===f.name&&b.status==="cancel").length;return n>0&&<span style={{fontSize:10,fontWeight:700,color:G5,background:G3,borderRadius:5,padding:"2px 6px"}}>취소 {n}회</span>})()}
                  </div>
                  <div style={{fontSize:11,color:G5}}>{f.phone}</div>
                </div>
                <button onClick={() => setF(p => ({...p,cid:"",name:"",phone:""}))}
                  style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:G5}}>×</button>
              </div>
            ) : (
              <button onClick={() => setShowC(true)}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,background:WH,textAlign:"left",cursor:"pointer",color:G5,boxSizing:"border-box"}}>
                고객 검색 / 신규 등록
              </button>
            )}
          </div>

          {/* 날짜 + 시간 */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>날짜</div>
                <button onClick={() => {setShowD(v=>!v);setShowT(false);}}
                  style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+(showD?P:G2),fontSize:12,background:WH,textAlign:"left",cursor:"pointer",color:DK,display:"flex",alignItems:"center",gap:6,boxSizing:"border-box"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showD?P:G5} strokeWidth="2" style={{flexShrink:0}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {f.date}
                </button>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>시간</div>
                <button onClick={() => {setShowT(v=>!v);setShowD(false);}}
                  style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+(showT?P:G2),fontSize:12,background:WH,textAlign:"left",cursor:"pointer",color:DK,display:"flex",alignItems:"center",gap:6,boxSizing:"border-box"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showT?P:G5} strokeWidth="2" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {f.time}
                </button>
              </div>
            </div>
            {showD && (
              <div style={{marginTop:8,background:PS,borderRadius:12,padding:"12px 10px",border:"1px solid "+G2}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:5}}>
                  {["일","월","화","수","목","금","토"].map((d,i) => <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:i===0||i===6?PM:G5}}>{d}</div>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                  {Array.from({length: new Date(_bYr, _bMo-1, 1).getDay()}).map((_,i) => <div key={"e"+i}/>)}
                  {calDays.map(({d,ds,we}) => {
                    const sel = f.date===ds;
                    return (
                      <div key={d} onClick={() => {set("date",ds);setShowD(false);}}
                        style={{aspectRatio:"1",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:sel?P:"transparent",cursor:"pointer"}}>
                        <span style={{fontSize:11,fontWeight:sel?700:400,color:sel?WH:we?PM:G7}}>{d}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {showT && (
              <div style={{marginTop:8,background:PS,borderRadius:12,padding:"10px",border:"1px solid "+G2}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                  {timeOpts.map(t => {
                    const sel = f.time===t;
                    return (
                      <button key={t} onClick={() => {set("time",t);setShowT(false);}}
                        style={{padding:"8px 2px",borderRadius:8,border:sel?"none":"1px solid "+G2,background:sel?P:WH,color:sel?WH:G7,fontSize:12,fontWeight:sel?700:400,cursor:"pointer",textAlign:"center"}}>{t}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 시술 + 소요시간 */}
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>시술명</div>
              <button onClick={() => setShowS(true)}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+(f.svc?P:G2),fontSize:13,background:WH,textAlign:"left",cursor:"pointer",color:f.svc?DK:G5,boxSizing:"border-box",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {f.svc || "시술 선택"}
              </button>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>소요시간</div>
              <select value={f.mins} onChange={e=>set("mins",e.target.value)}
                style={{width:"100%",padding:"10px 8px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,fontWeight:600,color:DK,background:WH,outline:"none",cursor:"pointer",appearance:"auto"}}>
                {[30,45,60,75,90,120,150,180].map(m=><option key={m} value={m}>{m}분</option>)}
              </select>
            </div>
          </div>
          {f.svc && f.svcPrice && (
            <div style={{marginBottom:14,marginTop:-8,padding:"8px 12px",background:PL,borderRadius:9}}>
              <span style={{fontSize:12,color:P,fontWeight:700}}>{Number(f.svcPrice).toLocaleString()}원</span>
            </div>
          )}

          {/* 예약금 수단 + 금액 */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>예약금</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7,marginBottom:8}}>
              {payOpts.map(o => {
                const sel = f.dep===o.v;
                return (
                  <button key={o.v} onClick={() => set("dep",o.v)}
                    style={{padding:"9px 2px",borderRadius:10,border:sel?"none":"1px solid "+G2,background:sel?o.ac:o.bg,color:sel?WH:o.tx,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{o.l}</button>
                );
              })}
            </div>
            {/* 예약금 금액 입력 */}
            {f.dep && f.dep !== "etc" && (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input
                  value={f.depAmt}
                  onChange={e => set("depAmt", e.target.value)}
                  type="number"
                  placeholder="예약금 금액 (선택)"
                  style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}
                />
                <span style={{fontSize:12,color:G5,flexShrink:0}}>원</span>
              </div>
            )}
            {/* 예약금 입력 시 잔금 미리보기 */}
            {f.depAmt && f.svcPrice && Number(f.depAmt) > 0 && (
              <div style={{marginTop:7,padding:"9px 12px",borderRadius:9,background:PS,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:G5}}>잔금 (시술 후 결제)</span>
                <span style={{fontSize:13,fontWeight:800,color:P}}>
                  {Math.max(0, Number(f.svcPrice) - Number(f.depAmt)).toLocaleString()}원
                </span>
              </div>
            )}
          </div>

          {/* 메모 */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>메모</div>
            <input value={f.memo} onChange={e => set("memo",e.target.value)} placeholder="특이사항"
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
          </div>

          {/* 태그 */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>고객 태그</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:9}}>
              {tagList.map(t => <Pill key={t} on={f.tags.includes(t)} onClick={() => togTag(t)}>{t}</Pill>)}
            </div>
            <div style={{display:"flex",gap:7}}>
              <input value={ct} onChange={e => setCt(e.target.value)} onKeyDown={e => {if(e.key==="Enter"){e.preventDefault();addTag();}}} placeholder="태그 직접 추가"
                style={{flex:1,padding:"8px 10px",borderRadius:9,border:"1.5px dashed "+PM,fontSize:11,outline:"none",color:DK,background:WH}}/>
              <button onMouseDown={e => {e.preventDefault();addTag();}}
                style={{padding:"8px 12px",borderRadius:9,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
            </div>
          </div>

          <button onClick={async () => {
            if(f.name||f.cid) {
              const newBk = {
                id: Date.now(),
                sid: Number(f.sid),
                date: f.date,
                time: f.time,
                mins: Number(f.mins),
                name: f.name || "미지정",
                phone: f.phone || "",
                svc: f.svc || "시술 미정",
                price: Number(f.svcPrice) || 0,
                dep: f.dep || "unpaid",
                depAmt: Number(f.depAmt) || 0,
                memo: f.memo,
              };
              if(onSave) {
                await onSave(newBk); // Firestore 저장
              } else {
                BKS = [...BKS, newBk]; // fallback
              }
            }
            onClose();
          }}
            style={{width:"100%",padding:"14px",borderRadius:14,background:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 5px 16px "+P+"44"}}>
            예약 등록 완료
          </button>
        </div>
      </Sheet>
      {showS && <SvcModal onSelect={s => {set("svc",s.name);set("mins",String(s.mins));set("svcPrice",String(s.price));setShowS(false);}} onClose={() => setShowS(false)}/>}
      {showC && <CustModal onSelect={c => {set("cid",String(c.id));set("name",c.name);set("phone",c.phone||"");setShowC(false);}} onClose={() => setShowC(false)} onSaveNew={onSaveNewCust}/>}
      {dupCust && (
        <div style={{position:"fixed",inset:0,background:"#0007",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:WH,borderRadius:16,padding:"24px 20px",width:300,boxShadow:"0 8px 32px #0003"}}>
            <div style={{fontSize:14,fontWeight:700,color:DK,marginBottom:14,textAlign:"center"}}>이미 등록된 고객이 있습니다</div>
            <div style={{background:G3,borderRadius:10,padding:"12px 14px",marginBottom:18}}>
              <div style={{fontSize:15,fontWeight:700,color:DK}}>{dupCust.name}</div>
              {dupCust.phone && <div style={{fontSize:12,color:G5,marginTop:3}}>{dupCust.phone}</div>}
              <div style={{fontSize:12,color:G5,marginTop:3}}>방문 {BKS.filter(b=>b.name===dupCust.name).length}회</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{set("cid",String(dupCust.id));setDupCust(null);}}
                style={{flex:1,padding:"11px 0",borderRadius:10,background:P,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                같은 고객
              </button>
              <button onClick={()=>{
                const newC={id:Date.now(),name:f.name,phone:f.phone||"",birth:"",memo:"",tags:[],visits:0,revenue:0};
                CUSTS=[...CUSTS,newC];
                if(onSaveNewCust) onSaveNewCust(newC);
                set("cid",String(newC.id));
                setDupCust(null);
              }} style={{flex:1,padding:"11px 0",borderRadius:10,background:WH,border:"1.5px solid "+G2,color:G7,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                신규 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 시술 기록 + 사진 업로드 팝업 ─────────────────────
function TreatmentRecordModal({ bk, onClose, onSave }) {
  const [notes, setNotes] = useState(bk.treatmentNotes || "");
  const [photos, setPhotos] = useState(bk.photos || []);
  const [nextVisit, setNextVisit] = useState(bk.nextVisit || "");
  const [condition, setCondition] = useState(bk.condition || "");
  const [usedProduct, setUsedProduct] = useState(bk.usedProduct || "");
  const fileRef = useRef(null);

  function handlePhoto(e) {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(p => [...p, {id:Date.now()+Math.random(), url:ev.target.result, name:f.name}]);
      reader.readAsDataURL(f);
    });
  }

  function save() {
    onSave({...bk, treatmentNotes:notes, photos, nextVisit, condition, usedProduct});
    onClose();
  }

  return (
    <Sheet onClose={onClose} maxH="92vh">
      <SheetHandle title="시술 기록" onClose={onClose}/>
      <div style={{flex:1,overflowY:"auto",padding:"0 18px 40px"}}>
        {/* 고객 + 시술 요약 */}
        <div style={{background:PL,borderRadius:12,padding:"12px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:DK}}>{bk.name}</div>
            <div style={{fontSize:11,color:G5,marginTop:2}}>{bk.svc} · {bk.date} {bk.time}</div>
          </div>
          <div style={{fontSize:15,fontWeight:800,color:P}}>{bk.price.toLocaleString()}원</div>
        </div>

        {/* 사진 업로드 */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:8,letterSpacing:0.3}}>시술 사진</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {photos.map(ph => (
              <div key={ph.id} style={{position:"relative",width:80,height:80}}>
                <img src={ph.url} alt="시술사진" style={{width:80,height:80,borderRadius:10,objectFit:"cover",border:"1px solid "+G2}}/>
                <button onClick={() => setPhotos(p => p.filter(x => x.id!==ph.id))}
                  style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:RD,border:"2px solid "+WH,color:WH,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              style={{width:80,height:80,borderRadius:10,border:"2px dashed "+PM,background:PS,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4}}>
              <span style={{fontSize:24,color:PM}}></span>
              <span style={{fontSize:9,color:PM,fontWeight:600}}>사진 추가</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{display:"none"}}/>
          </div>
        </div>

        {/* 네일 컨디션 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>네일 컨디션</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {["양호","보통","손상","주의필요"].map(c => (
              <button key={c} onClick={() => setCondition(c)}
                style={{padding:"7px 14px",borderRadius:20,border:condition===c?"none":"1px solid "+G2,background:condition===c?P:WH,color:condition===c?WH:G7,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 사용 제품 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>사용 제품</div>
          <input value={usedProduct} onChange={e => setUsedProduct(e.target.value)} placeholder="예: OPI #52, 젤 탑코트"
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
        </div>

        {/* 시술 메모 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>시술 메모</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="시술 내용, 특이사항, 다음 방문 시 참고사항 등" rows={4}
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,resize:"none",background:WH,boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>

        {/* 다음 방문 예정 */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:7,letterSpacing:0.3}}>다음 방문 예정</div>
          <div style={{display:"flex",gap:7}}>
            {["2주 후","3주 후","4주 후","직접 입력"].map(v => (
              <button key={v} onClick={() => setNextVisit(v==="직접 입력"?"":v)}
                style={{flex:1,padding:"8px 4px",borderRadius:10,border:nextVisit===v?"none":"1px solid "+G2,background:nextVisit===v?P:WH,color:nextVisit===v?WH:G7,fontSize:10,fontWeight:600,cursor:"pointer",textAlign:"center"}}>
                {v}
              </button>
            ))}
          </div>
          {(nextVisit && !["2주 후","3주 후","4주 후"].includes(nextVisit)) && (
            <input value={nextVisit} onChange={e => setNextVisit(e.target.value)} placeholder="예: 7월 중순"
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box",marginTop:8}}/>
          )}
        </div>

        <button onClick={save}
          style={{width:"100%",padding:"14px",borderRadius:14,background:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 5px 16px "+P+"44"}}>
          기록 저장
        </button>
      </div>
    </Sheet>
  );
}

// ── 타임테이블 ────────────────────────────────────────
function TT({ date, onAdd, staff, onPay, paidBks, treatmentRecords, onRecord, onCancelPay, onDelete, onUpdate, slotUnit=30 }) {
  // 타임테이블은 항상 30분 단위 슬롯으로 표시
  const DISPLAY_UNIT = 30;
  const SLOT_H_DYN = 26; // 슬롯 높이 고정
  const slots = makeSlots(DISPLAY_UNIT); // 항상 30분 단위

  // 시간 → 픽셀 오프셋 계산 (9:00 기준)
  function timeToOffset(timeStr) {
    const [h,m] = timeStr.split(":").map(Number);
    const totalMin = (h-9)*60 + m;
    return (totalMin / DISPLAY_UNIT) * SLOT_H_DYN;
  }
  // 분 → 픽셀 높이
  function minsToHeight(mins) {
    return (mins / DISPLAY_UNIT) * SLOT_H_DYN;
  }
  const [cur, setCur] = useState(date);
  const [fs, setFs] = useState(null);
  useEffect(() => { setCur(date); }, [date]);
  const [selBk, setSelBk] = useState(null);
  const [showMiniCal, setShowMiniCal] = useState(false);
  const [miniY, setMiniY] = useState(() => Number(date.slice(0,4)));
  const [miniM, setMiniM] = useState(() => Number(date.slice(5,7)));
  const [editBk, setEditBk] = useState(null);
  const [delConfirmBk, setDelConfirmBk] = useState(null);
  const [dragConfirm, setDragConfirm] = useState(null);
  const [swipeStartX, setSwipeStartX] = useState(0);
  // 드래그 상태
  const [dragBk, setDragBk] = useState(null);
  const [dragTime, setDragTime] = useState(null);
  const [dragDate, setDragDate] = useState(null);
  const [dragSid, setDragSid] = useState(null);
  const dragTimerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragMoveRef = useRef(null);
  const dragEndRef = useRef(null);
  const dragOrigDateRef = useRef(null);
  const dragTimeRef = useRef(null);
  const dragDateRef = useRef(null);
  const weekShiftTimerRef = useRef(null);
  const dragSidRef = useRef(null);
  const didDragRef = useRef(false);
  const DN = ["일","월","화","수","목","금","토"];
  const vis = fs !== null ? staff.filter(s => s.id === fs) : staff;
  const dayB = BKS.filter(b => b.date === cur);

  function getBks(sid, slot) { return dayB.filter(b => b.sid===sid && b.time===slot); }
  // 해당 30분 슬롯이 예약으로 덮여있는지 (예약 시작은 아닌데 예약 범위 안에 있는지)
  function covered(sid, slotTime) {
    return dayB.some(b => {
      if(b.sid!==sid) return false;
      if(b.time===slotTime) return false; // 시작 슬롯은 제외
      const bStart = timeToOffset(b.time);
      const bEnd = bStart + minsToHeight(b.mins);
      const slotOffset = timeToOffset(slotTime);
      return slotOffset > bStart && slotOffset < bEnd;
    });
  }
  function fmtDT(ds, ts) {
    const [yr,mo,dy] = ds.split('-').map(Number);
    const [h,m] = ts.split(':').map(Number);
    const ap = h>=12?'오후':'오전';
    const h12 = h>12?h-12:(h===0?12:h);
    return `${yr}.${mo}.${dy}. ${ap} ${h12}:${String(m).padStart(2,'0')}`;
  }
  // 빈 슬롯 클릭 시 해당 시간으로 예약 등록 (slotUnit 단위로 snap)
  function handleCellClick(slotTime, sid, e) {
    if(onAdd) {
      // 터치 위치로 더 정확한 시간 계산
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = (e.touches ? e.changedTouches[0].clientY : e.clientY) - rect.top;
      const totalMinFromSlot = Math.floor(clickY / SLOT_H_DYN * DISPLAY_UNIT / slotUnit) * slotUnit;
      const [sh, sm] = slotTime.split(":").map(Number);
      const totalMin = sh*60 + sm + Math.max(0, totalMinFromSlot);
      const snapped = Math.floor(totalMin / slotUnit) * slotUnit;
      const fh = String(Math.floor(snapped/60)).padStart(2,"0");
      const fm = String(snapped%60).padStart(2,"0");
      onAdd(fh+":"+fm, sid, cur);
    }
  }

  function localDs(d) {
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  function getWeekDays() {
    const base = new Date(cur+"T00:00:00");
    const sun = new Date(base);
    sun.setDate(base.getDate() - base.getDay());
    return Array.from({length:7}, (_,i) => {
      const d = new Date(sun);
      d.setDate(sun.getDate()+i);
      const ds = localDs(d);
      return {dn:DN[i],dt:d.getDate(),mo:d.getMonth()+1,ds,sel:ds===cur,hasBk:BKS.some(b=>b.date===ds),isWe:i===0||i===6};
    });
  }
  const weekDays = getWeekDays();
  const weekDaysRef = useRef(weekDays);
  weekDaysRef.current = weekDays;
  const weekLabel = (() => { const f=weekDays[0],l=weekDays[6]; return f.mo===l.mo?f.mo+"월":f.mo+"~"+l.mo+"월"; })();

  function shiftWeek(dir) {
    const base = new Date(cur+"T00:00:00");
    base.setDate(base.getDate() + dir*7);
    setCur(localDs(base));
  }

  const depLabel = dep => {
    if(dep==="naver_paid") return "N페이 + 예약금완료";
    if(dep==="naver")      return "N페이 예약금";
    if(dep==="paid")       return "예약금 완료";
    if(dep==="unpaid")     return "미납";
    if(dep==="transfer")   return "계좌이체";
    if(dep==="cash")       return "현금";
    if(dep==="card")       return "카드";
    if(dep==="etc")        return "기타";
    return dep || "미납";
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh"}}
      onTouchStart={e => { if(!isDraggingRef.current) setSwipeStartX(e.touches[0].clientX); }}
      onTouchEnd={e => { if(isDraggingRef.current) return; const dx=e.changedTouches[0].clientX-swipeStartX; if(Math.abs(dx)>60){dx<0?shiftWeek(1):shiftWeek(-1);} }}>
      <div style={{background:WH,borderBottom:"1px solid "+G2,paddingTop:8,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"0 12px 4px",position:"relative"}}>
          <span onClick={() => { setMiniY(Number(cur.slice(0,4))); setMiniM(Number(cur.slice(5,7))); setShowMiniCal(v=>!v); }} style={{fontSize:13,fontWeight:700,color:DK,cursor:"pointer",padding:"2px 10px",borderRadius:8,userSelect:"none"}}>{weekLabel} ▾</span>
          {showMiniCal && (() => {
            const dim2 = new Date(miniY, miniM, 0).getDate();
            const fd2 = new Date(miniY, miniM-1, 1).getDay();
            const cells = [];
            for(let i=0;i<fd2;i++) cells.push(null);
            for(let d=1;d<=dim2;d++) cells.push(d);
            const pad = s => String(s).padStart(2,"0");
            return (
              <>
                <div onClick={() => setShowMiniCal(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                <div style={{position:"absolute",top:"110%",left:"50%",transform:"translateX(-50%)",zIndex:200,background:WH,borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",border:"1px solid "+G2,padding:"12px 10px",minWidth:240}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <button onClick={e=>{e.stopPropagation();if(miniM===1){setMiniM(12);setMiniY(y=>y-1);}else setMiniM(m=>m-1);}} style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 8px",lineHeight:1}}>‹</button>
                    <span style={{fontSize:13,fontWeight:700,color:DK}}>{miniY}년 {miniM}월</span>
                    <button onClick={e=>{e.stopPropagation();if(miniM===12){setMiniM(1);setMiniY(y=>y+1);}else setMiniM(m=>m+1);}} style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 8px",lineHeight:1}}>›</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
                    {["일","월","화","수","목","금","토"].map((d,i)=>(
                      <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:i===0||i===6?RD:G5}}>{d}</div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                    {cells.map((d,i) => {
                      if(!d) return <div key={"e"+i}/>;
                      const ds = miniY+"-"+pad(miniM)+"-"+pad(d);
                      const isSel = ds===cur; const isToday = ds===TODAY;
                      const hasBk = BKS.some(b=>b.date===ds);
                      const isWe = i%7===0||i%7===6;
                      return (
                        <div key={d} onClick={e=>{e.stopPropagation();setCur(ds);setShowMiniCal(false);}}
                          style={{textAlign:"center",padding:"5px 2px",borderRadius:8,cursor:"pointer",background:isSel?P:"transparent",border:isToday&&!isSel?"1.5px solid "+P:"none"}}>
                          <span style={{fontSize:11,fontWeight:isSel?700:400,color:isSel?WH:isWe?RD:G7}}>{d}</span>
                          {hasBk && !isSel && <div style={{width:3,height:3,borderRadius:"50%",background:P,margin:"1px auto 0"}}/>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
        <div data-zone="weekheader" style={{display:"flex",padding:"0 8px",gap:1}}>
          {weekDays.map((w,i) => {
            const isDragTarget = dragBk && dragDate && w.ds===dragDate && !w.sel;
            return (
              <div key={i} data-date={w.ds} onClick={() => setCur(w.ds)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"3px 0 5px",cursor:"pointer"}}>
                <span style={{fontSize:9,color:w.sel?P:isDragTarget?OR:w.isWe?RD:G5,fontWeight:isDragTarget?700:600,marginBottom:2}}>{w.dn}</span>
                <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                  background:w.sel?P:isDragTarget?ORL:"transparent",
                  border:isDragTarget?"1.5px solid "+OR:"none",
                  transition:"all 0.12s"}}>
                  <span style={{fontSize:12,fontWeight:w.sel||isDragTarget?700:400,color:w.sel?WH:isDragTarget?OR:w.isWe?RD:G7}}>{w.dt}</span>
                </div>
                {w.hasBk && !w.sel && !isDragTarget && <div style={{width:4,height:4,borderRadius:"50%",background:P,marginTop:1}}/>}
                {isDragTarget && <div style={{width:4,height:4,borderRadius:"50%",background:OR,marginTop:1}}/>}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:6,padding:"5px 12px 8px",overflowX:"auto"}}>
          {[{id:null,name:"전체"},...staff].map(s => {
            const on = fs===s.id;
            return (
              <button key={s.id??"all"} onClick={() => setFs(on?null:s.id)}
                style={{padding:"3px 11px",borderRadius:20,border:on?"none":"1px solid "+G2,background:on?P:WH,color:on?WH:G5,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s.name}</button>
            );
          })}
        </div>
      </div>

      <div data-zone="timetable" style={{flex:1,overflowY:"auto",overflowX:"auto"}}>
        <div style={{minWidth: 64 + vis.length*90}}>
          <div style={{position:"sticky",top:0,zIndex:10,display:"grid",gridTemplateColumns:"64px repeat("+vis.length+",1fr)",background:WH,borderBottom:"2px solid "+G3}}>
            <div/>
            {vis.map(s => {
              const isTargetStaff = dragBk && dragSid === s.id && dragSid !== dragBk.sid;
              return (
                <div key={s.id} style={{padding:"5px 4px",textAlign:"center",borderLeft:"1px solid "+G2,
                  background:isTargetStaff?"#7C3AED33":s.bg,
                  transition:"background 0.12s"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:isTargetStaff?"#7C3AED":PM,margin:"0 auto 2px",opacity:0.6}}/>
                  <span style={{fontSize:11,fontWeight:700,color:isTargetStaff?"#7C3AED":DK}}>{s.name}</span>
                </div>
              );
            })}
          </div>
          {slots.map((slot,idx) => {
            const isH = slot.endsWith(":00");
            const isWork = isWorkHour(slot);
            const offBg = OB;
            const offStaff = OS;
            return (
              <div key={slot} style={{
                display:"grid", gridTemplateColumns:"64px repeat("+vis.length+",1fr)",
                height:SLOT_H_DYN, position:"relative",
                borderTop: isH
                  ? "1px solid "+(isWork?G3:G2)
                  : "1px dotted "+(isWork?G2:OB),
                background: isWork ? "transparent" : offBg,
              }}>
                {/* 시간 레이블 - :00만 표시 */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",paddingRight:8,paddingTop:isH?3:2,flexShrink:0,background:isWork?WH:offBg}}>
                  {isH && <span style={{fontSize:12,fontWeight:isWork?700:500,color:isWork?DK:G5}}>{slot}</span>}
                </div>
                {/* 담당자 컬럼 */}
                {vis.map((s,si) => {
                  const isCovered = covered(s.id, slot);
                  const bks = getBks(s.id, slot);
                  const cellBg = isWork ? s.bg : (si%2===0?offBg:offStaff);

                  if(isCovered) {
                    return <div key={s.id} data-sid={s.id} style={{background:cellBg, borderLeft:si>0?"1px solid "+G2:"none"}}/>;
                  }

                  return (
                    <div key={s.id}
                      data-sid={s.id}
                      onClick={e => { if(bks.length===0) handleCellClick(slot, s.id, e); }}
                      style={{background:cellBg, borderLeft:si>0?"1px solid "+G2:"none",
                        position:"relative", cursor:"pointer"}}>
                      {/* 예약 블록 - 이 슬롯이 예약 시작 시간일 때만 렌더 */}
                      {bks.map((bk, bkIdx) => {
                        const n = bks.length;
                        const colW = 100 / n;
                        const bH = minsToHeight(bk.mins) - 2;
                        const et = endTime(bk.time, bk.mins);
                        const rec = treatmentRecords?.[bk.id];
                        const [,bm] = bk.time.split(":").map(Number);
                        const slotMin = bm % DISPLAY_UNIT;
                        const topOffset = (slotMin / DISPLAY_UNIT) * SLOT_H_DYN + 1;
                        const isPaid = !!(paidBks?.[bk.id]);
                        const isThisDrag = dragBk?.id === bk.id;
                        const dragTop = (() => {
                          if(!isThisDrag || !dragTime) return topOffset;
                          const [bH,bM] = bk.time.split(":").map(Number);
                          const [dH,dM] = dragTime.split(":").map(Number);
                          return topOffset + ((dH*60+dM)-(bH*60+bM)) / DISPLAY_UNIT * SLOT_H_DYN;
                        })();
                        return (
                          <div
                            key={bk.id}
                            onClick={e => { e.stopPropagation(); if(didDragRef.current){didDragRef.current=false;return;} setSelBk(bk); }}
                            onTouchStart={e => {
                              if(isPaid) return;
                              const t0 = e.touches[0];
                              dragStartYRef.current = t0.clientY;
                              dragStartXRef.current = t0.clientX;
                              dragOrigDateRef.current = cur;
                              dragTimerRef.current = setTimeout(() => {
                                isDraggingRef.current = true;
                                didDragRef.current = false;
                                setDragBk(bk);
                                setDragTime(bk.time);
                                setDragDate(cur);
                                setDragSid(bk.sid);
                                const origTime = bk.time;
                                const origDate = cur;
                                const origSid  = bk.sid;
                                dragMoveRef.current = ev => {
                                  ev.preventDefault();
                                  const touch = ev.touches[0];
                                  const dy = touch.clientY - dragStartYRef.current;
                                  // 세로: 시간 변경
                                  const slots = Math.round(dy / SLOT_H_DYN);
                                  const [oh,om] = origTime.split(":").map(Number);
                                  const total = Math.max(9*60, Math.min(21*60, oh*60+om+slots*DISPLAY_UNIT));
                                  const snapped = Math.floor(total/slotUnit)*slotUnit;
                                  const nh = String(Math.floor(snapped/60)).padStart(2,"0");
                                  const nm = String(snapped%60).padStart(2,"0");
                                  setDragTime(nh+":"+nm);
                                  // 가로: zone 기반 (마우스와 동일)
                                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                                  const zone = el?.closest('[data-zone]')?.dataset.zone;
                                  if(zone === 'weekheader') {
                                    const dateEl = el?.closest('[data-date]');
                                    if(dateEl) setDragDate(dateEl.dataset.date);
                                    setDragSid(origSid);
                                  } else {
                                    const sidEl = el?.closest('[data-sid]');
                                    if(sidEl) setDragSid(Number(sidEl.dataset.sid));
                                    setDragDate(origDate);
                                  }
                                };
                                dragEndRef.current = () => {
                                  setDragBk(null);
                                  setDragTime(t => {
                                    setDragDate(d => {
                                      setDragSid(s => {
                                        const tChanged = t && t!==origTime;
                                        const dChanged = d && d!==origDate;
                                        const sChanged = s && s!==origSid;
                                        if(tChanged||dChanged||sChanged) {
                                          const upd = {};
                                          if(tChanged) upd.time = t;
                                          if(dChanged) upd.date = d;
                                          if(sChanged) upd.sid = s;
                                          setTimeout(() => setDragConfirm({bk,origDate,origTime,origSid,newDate:d||origDate,newTime:t||origTime,newSid:s||origSid,upd}), 0);
                                        }
                                        return null;
                                      });
                                      return null;
                                    });
                                    return null;
                                  });
                                  isDraggingRef.current = false;
                                  didDragRef.current = true;
                                  document.removeEventListener("touchmove", dragMoveRef.current);
                                  document.removeEventListener("touchend", dragEndRef.current);
                                };
                                document.addEventListener("touchmove", dragMoveRef.current, {passive:false});
                                document.addEventListener("touchend", dragEndRef.current);
                              }, 500);
                            }}
                            onTouchEnd={() => { clearTimeout(dragTimerRef.current); }}
                            onTouchMove={e => {
                              if(isDraggingRef.current) return;
                              const dy = Math.abs(e.touches[0].clientY - dragStartYRef.current);
                              const dx = Math.abs(e.touches[0].clientX - dragStartXRef.current);
                              if(dy > 12 || dx > 20) clearTimeout(dragTimerRef.current);
                            }}
                            onMouseDown={e => {
                              if(isPaid) return;
                              e.preventDefault();
                              dragStartYRef.current = e.clientY;
                              dragStartXRef.current = e.clientX;
                              const origTime = bk.time;
                              const origDate = cur;
                              const origSid = bk.sid;
                              dragTimeRef.current = origTime;
                              dragDateRef.current = origDate;
                              dragSidRef.current = origSid;
                              const onMove = ev => {
                                const dy = ev.clientY - dragStartYRef.current;
                                const dx = ev.clientX - dragStartXRef.current;
                                if(!isDraggingRef.current) {
                                  if(Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
                                  isDraggingRef.current = true;
                                  didDragRef.current = false;
                                  setDragBk(bk);
                                  setDragTime(origTime);
                                  setDragDate(origDate);
                                  setDragSid(origSid);
                                }
                                // 세로: 시간 변경
                                const slots = Math.round(dy / SLOT_H_DYN);
                                const [oh,om] = origTime.split(":").map(Number);
                                const total = Math.max(9*60, Math.min(21*60, oh*60+om+slots*DISPLAY_UNIT));
                                const snapped = Math.floor(total/slotUnit)*slotUnit;
                                const newTime = String(Math.floor(snapped/60)).padStart(2,"0")+":"+String(snapped%60).padStart(2,"0");
                                dragTimeRef.current = newTime;
                                setDragTime(newTime);
                                // 가로: zone 기반으로 날짜(헤더) 또는 담당자(테이블) 감지
                                const el = document.elementFromPoint(ev.clientX, ev.clientY);
                                const zone = el?.closest('[data-zone]')?.dataset.zone;
                                if(zone === 'weekheader') {
                                  // 날짜 변경 모드
                                  const dateEl = el?.closest('[data-date]');
                                  if(dateEl) {
                                    dragDateRef.current = dateEl.dataset.date;
                                    setDragDate(dateEl.dataset.date);
                                  }
                                  // 담당자는 원래대로
                                  dragSidRef.current = origSid;
                                  setDragSid(origSid);
                                  // 첫날/마지막날 머물면 자동 주 이동 (타이머 중복 방지)
                                  const wd = weekDaysRef.current;
                                  const curDragDate = dragDateRef.current;
                                  if(curDragDate === wd[6].ds) {
                                    if(!weekShiftTimerRef.current) {
                                      weekShiftTimerRef.current = setTimeout(() => { weekShiftTimerRef.current = null; shiftWeek(1); }, 700);
                                    }
                                  } else if(curDragDate === wd[0].ds) {
                                    if(!weekShiftTimerRef.current) {
                                      weekShiftTimerRef.current = setTimeout(() => { weekShiftTimerRef.current = null; shiftWeek(-1); }, 700);
                                    }
                                  } else {
                                    clearTimeout(weekShiftTimerRef.current);
                                    weekShiftTimerRef.current = null;
                                  }
                                } else {
                                  // 담당자 변경 모드 (timetable 또는 기타)
                                  clearTimeout(weekShiftTimerRef.current);
                                  const sidEl = el?.closest('[data-sid]');
                                  if(sidEl) {
                                    const newSid = Number(sidEl.dataset.sid);
                                    dragSidRef.current = newSid;
                                    setDragSid(newSid);
                                  }
                                  // 날짜는 원래대로
                                  dragDateRef.current = origDate;
                                  setDragDate(origDate);
                                }
                              };
                              const onUp = () => {
                                clearTimeout(weekShiftTimerRef.current);
                                if(isDraggingRef.current) {
                                  const finalTime = dragTimeRef.current;
                                  const finalDate = dragDateRef.current;
                                  const finalSid = dragSidRef.current;
                                  setDragBk(null); setDragTime(null); setDragDate(null); setDragSid(null);
                                  const upd = {};
                                  if(finalTime !== origTime) upd.time = finalTime;
                                  if(finalDate !== origDate) upd.date = finalDate;
                                  if(finalSid !== origSid) upd.sid = finalSid;
                                  if(Object.keys(upd).length > 0) {
                                    setDragConfirm({bk,origDate,origTime,origSid,newDate:finalDate,newTime:finalTime,newSid:finalSid,upd});
                                  }
                                  didDragRef.current = true;
                                }
                                isDraggingRef.current = false;
                                document.removeEventListener("mousemove", onMove);
                                document.removeEventListener("mouseup", onUp);
                              };
                              document.addEventListener("mousemove", onMove);
                              document.addEventListener("mouseup", onUp);
                            }}
                            style={{
                              position:"absolute",
                              top:dragTop,
                              left:`calc(${colW*bkIdx}% + 2px)`,
                              width:`calc(${colW}% - 4px)`,
                              height:Math.max(bH, 18),
                              background: isPaid ? ORL : WH,
                              border:"1.5px solid "+(isPaid?OR:rec?GR:P),
                              borderRadius:7,
                              padding:"2px 3px",
                              overflow:"hidden",
                              cursor: isThisDrag ? "grabbing" : isPaid ? "pointer" : "grab",
                              boxShadow: isThisDrag?"0 8px 28px rgba(0,0,0,0.28)":"0 2px 8px "+P+"22",
                              zIndex: isThisDrag ? 99 : 5,
                              opacity: isThisDrag ? 0.88 : 1,
                              transform: isThisDrag ? "scale(1.03)" : "none",
                              pointerEvents: isThisDrag ? "none" : undefined,
                              transition: isThisDrag ? "none" : undefined,
                            }}>
                            <div style={{display:"flex",alignItems:"center",gap:2,marginBottom:1}}>
                              {n===1 && <Badge dep={bk.dep}/>}
                              <div style={{fontSize:n>1?9:11,fontWeight:800,color:isPaid?OR:DK,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{bk.name}</div>
                            </div>
                            {n===1 && <div style={{fontSize:9,color:G5,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{bk.svc}</div>}
                            {n===1 && bk.mins>=60 && <div style={{fontSize:9,color:G7}}>{bk.time}~{et}</div>}
                            {n===1 && bk.mins>=90 && <div style={{fontSize:9,color:P,fontWeight:700}}>{bk.price.toLocaleString()}원</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 예약 상세 팝업 */}
      {selBk && (
        <Sheet onClose={() => setSelBk(null)} maxH="88vh">
          <div style={{overflowY:"auto",flex:1,padding:"0 18px 40px"}}>
            <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"12px auto 16px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:800,color:DK}}>예약 상세</span>
              <button onClick={() => setSelBk(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px",borderRadius:14,background:PL,marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:P,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:WH,flexShrink:0}}>{selBk.name[0]}</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:DK}}>{selBk.name}</div>
                {(selBk.phone||(CUSTS.find(c=>c.name===selBk.name)?.phone)) && <div style={{fontSize:12,color:P,fontWeight:600,marginBottom:1}}>{selBk.phone||CUSTS.find(c=>c.name===selBk.name)?.phone}</div>}
                <div style={{fontSize:12,color:G5}}>담당자{selBk.sid+1}</div>
              </div>
            </div>
            {/* 상세 정보 */}
            {[
              {l:"날짜",     v:selBk.date},
              {l:"시간",     v:selBk.time+" ~ "+endTime(selBk.time,selBk.mins)},
              {l:"시술",     v:selBk.svc},
              {l:"시술시간", v:selBk.mins+"분"},
            ].map((r,i) => (
              <div key={i} style={{display:"flex",padding:"11px 0",borderBottom:"1px solid "+G2}}>
                <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>{r.l}</span>
                <span style={{fontSize:13,fontWeight:600,color:DK}}>{r.v}</span>
              </div>
            ))}

            {/* 시술금액 + 예약금 + 잔금 통합 블록 */}
            {(()=>{
              const paid=paidBks&&paidBks[selBk.id];
              const svcAmt=paid?paid.amount:selBk.price;
              const depA=selBk.depAmt||0;
              return (
                <div style={{margin:"8px 0",borderRadius:12,border:"1px solid "+G2,overflow:"hidden"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:"1px solid "+G2}}>
                    <span style={{fontSize:12,color:G5}}>시술 금액</span>
                    <span style={{fontSize:14,fontWeight:700,color:DK}}>{svcAmt.toLocaleString()}원</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:"1px solid "+G2,background:PS}}>
                    <div>
                      <span style={{fontSize:12,color:G5}}>예약금 </span>
                      <span style={{fontSize:12,fontWeight:600,color:selBk.dep==="unpaid"?RD:P}}>{depLabel(selBk.dep)}</span>
                    </div>
                    {depA>0
                      ?<span style={{fontSize:13,fontWeight:700,color:GR}}>−{depA.toLocaleString()}원</span>
                      :<span style={{fontSize:12,color:selBk.dep==="unpaid"?RD:G5}}>{selBk.dep==="unpaid"?"미납입":"금액 미기재"}</span>
                    }
                  </div>
                  {depA>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:PL}}>
                      <span style={{fontSize:13,fontWeight:700,color:DK}}>잔금 (오늘 결제)</span>
                      <span style={{fontSize:16,fontWeight:800,color:P}}>{Math.max(0,svcAmt-depA).toLocaleString()}원</span>
                    </div>
                  )}
                  {(!depA||depA===0)&&selBk.dep!=="unpaid"&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:PL}}>
                      <span style={{fontSize:13,fontWeight:700,color:DK}}>결제 금액</span>
                      <span style={{fontSize:16,fontWeight:800,color:P}}>{svcAmt.toLocaleString()}원</span>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* 결제 상태 */}
            <div style={{display:"flex",padding:"11px 0",borderBottom:"1px solid "+G2,alignItems:"center"}}>
              <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>결제</span>
              {paidBks&&paidBks[selBk.id] ? (
                <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <span style={{fontSize:13,fontWeight:700,color:OR}}>{paidBks[selBk.id].method}</span>
                    {(paidBks[selBk.id].chargeBonus||0)>0 && (
                      <div style={{fontSize:11,color:OR,marginTop:1}}>(+보너스 {(paidBks[selBk.id].chargeBonus).toLocaleString()}원)</div>
                    )}
                    {paidBks[selBk.id].paidAmt > 0 && (
                      <div style={{fontSize:11,color:OR,marginTop:2}}>{paidBks[selBk.id].paidAmt.toLocaleString()}원 결제</div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={() => {if(onPay)onPay(selBk);setSelBk(null);}}
                      style={{padding:"4px 10px",borderRadius:8,background:PL,border:"1px solid "+PM,color:P,fontSize:10,fontWeight:700,cursor:"pointer"}}>수정</button>
                    <button onClick={() => {
                      if(onCancelPay) onCancelPay(selBk.id, selBk.name);
                      setSelBk(null);
                    }} style={{padding:"4px 10px",borderRadius:8,background:"#FFF0F0",border:"1px solid "+RD,color:RD,fontSize:10,fontWeight:700,cursor:"pointer"}}>취소</button>
                  </div>
                </div>
              ) : (
                <span style={{fontSize:13,fontWeight:600,color:G5}}>미결제</span>
              )}
            </div>
            <div style={{display:"flex",gap:9,marginTop:14}}>
              {(!paidBks||!paidBks[selBk.id]) && (
                <button onClick={() => setDelConfirmBk(selBk)}
                  style={{padding:"11px 14px",borderRadius:13,background:WH,border:"1.5px solid "+G2,color:G7,fontSize:12,fontWeight:700,cursor:"pointer"}}>삭제</button>
              )}
              <button onClick={() => { setEditBk({...selBk}); setSelBk(null); }}
                style={{flex:1,padding:"11px",borderRadius:13,background:WH,border:"1.5px solid "+G2,color:G7,fontSize:12,fontWeight:700,cursor:"pointer"}}>예약 수정</button>
              {(!paidBks||!paidBks[selBk.id]) && (
                <button onClick={() => {if(onPay)onPay(selBk);setSelBk(null);}}
                  style={{flex:1,padding:"11px",borderRadius:13,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 12px "+P+"44"}}>결제</button>
              )}
              <button onClick={() => {if(onRecord)onRecord(selBk);setSelBk(null);}}
                style={{flex:1,padding:"11px",borderRadius:13,background:paidBks&&paidBks[selBk.id]?P:WH,border:"1.5px solid "+(paidBks&&paidBks[selBk.id]?P:G2),color:paidBks&&paidBks[selBk.id]?WH:G7,fontSize:12,fontWeight:700,cursor:"pointer"}}>기록</button>
            </div>
          </div>
        </Sheet>
      )}
      {/* 예약 수정 팝업 (타임테이블) */}
      {editBk && (
        <EditBookingSheet
          editBk={editBk} setEditBk={setEditBk} staff={staff}
          slotUnit={slotUnit}
          onSave={() => {
            const idx = BKS.findIndex(b => b.id===editBk.id);
            if(idx>=0) BKS[idx] = {...BKS[idx], ...editBk};
            if(onUpdate) onUpdate(editBk, editBk);
            setEditBk(null);
          }}
          onClose={() => setEditBk(null)}
        />
      )}
      {delConfirmBk && (
        <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setDelConfirmBk(null)}>
          <div style={{background:WH,borderRadius:"20px 20px 0 0",padding:"28px 20px 44px",width:"100%",maxWidth:430,boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,color:DK,marginBottom:8,textAlign:"center"}}>예약 삭제</div>
            <div style={{fontSize:13,color:G5,marginBottom:28,textAlign:"center",lineHeight:1.6}}>삭제된 예약은 복구할 수 없습니다.<br/>예약을 삭제하시겠습니까?</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDelConfirmBk(null)} style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
              <button onClick={()=>{if(onDelete)onDelete(delConfirmBk);setSelBk(null);setDelConfirmBk(null);}} style={{flex:1,padding:"13px",borderRadius:13,background:"#FF4D4D",border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer"}}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {dragConfirm && (() => {
        const {bk,origDate,origTime,origSid,newDate,newTime,newSid,upd} = dragConfirm;
        const origStaffName = staff.find(s=>s.id===origSid)?.name||'';
        const newStaffName  = staff.find(s=>s.id===newSid)?.name||'';
        const staffChanged  = newSid !== origSid;
        return (
          <div style={{position:"fixed",inset:0,zIndex:610,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setDragConfirm(null)}>
            <div style={{background:WH,borderRadius:"20px 20px 0 0",padding:"28px 20px 44px",width:"100%",maxWidth:430,boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:800,color:DK,marginBottom:6,textAlign:"center"}}>예약 변경 확인</div>
              <div style={{fontSize:13,fontWeight:700,color:P,marginBottom:14,textAlign:"center"}}>{bk.name} 고객</div>
              <div style={{background:PS,borderRadius:14,padding:"14px 16px",marginBottom:24}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:11,color:G5,fontWeight:600,minWidth:40,textAlign:"right"}}>변경 전</span>
                  <span style={{fontSize:13,color:G7}}>{fmtDT(origDate,origTime)}{staffChanged?` · ${origStaffName}`:''}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
                  <span style={{fontSize:18,color:PM}}>↓</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:11,color:P,fontWeight:700,minWidth:40,textAlign:"right"}}>변경 후</span>
                  <span style={{fontSize:14,fontWeight:800,color:DK}}>{fmtDT(newDate,newTime)}{staffChanged?` · ${newStaffName}`:''}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setDragConfirm(null)} style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
                <button onClick={()=>{if(onUpdate){onUpdate(bk,upd);if(upd.date)setCur(upd.date);}setDragConfirm(null);}} style={{flex:1,padding:"13px",borderRadius:13,background:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer"}}>확인</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
function CalPage({ onDate }) {
  const [yr, setYr] = useState(() => new Date().getFullYear());
  const [mo, setMo] = useState(() => new Date().getMonth() + 1);
  const DL = ["일","월","화","수","목","금","토"];
  const [showCalPop, setShowCalPop] = useState(false);
  const [popY, setPopY] = useState(() => new Date().getFullYear());
  const [popM, setPopM] = useState(() => new Date().getMonth() + 1);
  const dim = new Date(yr,mo,0).getDate();
  const fd = new Date(yr,mo-1,1).getDay();

  function prevMo() { if(mo===1){setYr(y=>y-1);setMo(12);}else setMo(m=>m-1); }
  function nextMo() { if(mo===12){setYr(y=>y+1);setMo(1);}else setMo(m=>m+1); }

  const days = Array.from({length:dim},(_,i) => {
    const d=i+1;
    const ds=yr+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const bks=BKS.filter(b=>b.date===ds);
    const dow=(fd+i)%7;
    return {d,ds,bks,isT:ds===TODAY,isW:dow===0||dow===6,hol:HOLS[ds]};
  });

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 175px)",padding:"2px 8px 0"}}>
      <div style={{background:WH,borderRadius:16,padding:"2px 8px 2px",border:"1px solid "+G2,flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexShrink:0}}>
          <button onClick={prevMo} style={{width:24,height:24,borderRadius:"50%",border:"1px solid "+G2,background:WH,cursor:"pointer",color:G7,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <div style={{position:"relative",display:"flex",alignItems:"center"}}>
            <span onClick={() => { setPopY(yr); setPopM(mo); setShowCalPop(v=>!v); }} style={{fontSize:15,fontWeight:800,color:DK,cursor:"pointer",padding:"2px 8px",borderRadius:8,userSelect:"none"}}>{yr}년 {mo}월 ▾</span>
            {showCalPop && (() => {
              const dim2 = new Date(popY, popM, 0).getDate();
              const fd2 = new Date(popY, popM-1, 1).getDay();
              const cells = [];
              for(let i=0;i<fd2;i++) cells.push(null);
              for(let n=1;n<=dim2;n++) cells.push(n);
              const pad = s => String(s).padStart(2,"0");
              return (
                <>
                  <div onClick={() => setShowCalPop(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                  <div style={{position:"absolute",top:"110%",left:"50%",transform:"translateX(-50%)",zIndex:200,background:WH,borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",border:"1px solid "+G2,padding:"12px 10px",minWidth:240}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <button onClick={e=>{e.stopPropagation();if(popM===1){setPopM(12);setPopY(y=>y-1);}else setPopM(m=>m-1);}} style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 8px",lineHeight:1}}>‹</button>
                      <span style={{fontSize:13,fontWeight:700,color:DK}}>{popY}년 {popM}월</span>
                      <button onClick={e=>{e.stopPropagation();if(popM===12){setPopM(1);setPopY(y=>y+1);}else setPopM(m=>m+1);}} style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 8px",lineHeight:1}}>›</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
                      {["일","월","화","수","목","금","토"].map((dl,i)=>(
                        <div key={dl} style={{textAlign:"center",fontSize:9,fontWeight:600,color:i===0||i===6?RD:G5}}>{dl}</div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                      {cells.map((n,i) => {
                        if(!n) return <div key={"e"+i}/>;
                        const ds = popY+"-"+pad(popM)+"-"+pad(n);
                        const isSel = popY===yr && popM===mo && n===new Date(yr+"-"+pad(mo)+"-01").getDate();
                        const isToday = ds===TODAY;
                        const hasBk = BKS.some(b=>b.date===ds);
                        const isWe = i%7===0||i%7===6;
                        return (
                          <div key={n} onClick={e=>{e.stopPropagation();setYr(popY);setMo(popM);setShowCalPop(false);}}
                            style={{textAlign:"center",padding:"5px 2px",borderRadius:8,cursor:"pointer",background:isToday?P:"transparent",border:"none"}}>
                            <span style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?WH:isWe?RD:G7}}>{n}</span>
                            {hasBk && !isToday && <div style={{width:3,height:3,borderRadius:"50%",background:P,margin:"1px auto 0"}}/>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <button onClick={nextMo} style={{width:24,height:24,borderRadius:"50%",border:"1px solid "+G2,background:WH,cursor:"pointer",color:G7,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:2,flexShrink:0}}>
          {DL.map((d,i) => <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:i===0||i===6?RD:G5,paddingBottom:1}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gridAutoRows:"minmax(0,1fr)",gap:0,flex:1,border:"1px solid "+G2,borderRadius:6,overflow:"hidden"}}>
          {Array.from({length:fd}).map((_,i) => <div key={"e"+i} style={{borderRight:"1px solid "+G2,borderBottom:"1px solid "+G2}}/>)}
          {days.map(day => (
            <div key={day.d} onClick={() => onDate(day.ds)}
              style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0",background:day.isT?P:day.bks.length>0?PS:"transparent",cursor:"pointer",overflow:"hidden",minHeight:0,borderRight:"1px solid "+G2,borderBottom:"1px solid "+G2}}>
              <span style={{fontSize:10,fontWeight:day.isT||day.bks.length>0?700:400,color:day.isT?WH:day.hol||day.isW?RD:day.bks.length>0?P:G7,lineHeight:1.0}}>{day.d}</span>
              {day.hol&&!day.isT&&<span style={{fontSize:5,color:RD,lineHeight:1,textAlign:"center"}}>{day.hol}</span>}
              {day.bks.length>0 && <div style={{width:"85%",height:"0.5px",background:day.isT?"rgba(255,255,255,0.35)":G2,margin:"1.5px 0"}}/>}
              {day.bks.slice(0,5).map(b => (
                <div key={b.id} style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",textAlign:"center",color:day.isT?"rgba(255,255,255,0.7)":"rgba(109,78,201,0.65)",lineHeight:1.0,padding:"0 1px",marginBottom:1}}>{b.name}</div>
              ))}
              {day.bks.length>5 && <div style={{fontSize:9,fontWeight:700,color:day.isT?"rgba(255,255,255,0.7)":G5,lineHeight:1}}>+{day.bks.length-5}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 고객 페이지 (수정 기능 추가) ─────────────────────
function CustPage({ onSaveNew, paidBks, prepaidData, onDeleteBooking, onDeleteCust }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [showR, setShowR] = useState(false);
  const [custs, setCusts] = useState(CUSTS);
  const [nc, setNc] = useState({name:"",phone:"",memo:"",tags:[]});
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(null);
  const [selVisit, setSelVisit] = useState(null); // 방문 이력 상세 팝업
  const [deletedBkIds, setDeletedBkIds] = useState(new Set());
  const [showCustMenu, setShowCustMenu] = useState(false);
  const [smsEdit, setSmsEdit] = useState(null); // {phone, body}
  const TAGS = ["VIP","단골","예약금 필수","노쇼 주의","큐티클 예민","왼손잡이","손톱 얇음","다한증"];
  const [customTags, setCustomTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [showNaverImport, setShowNaverImport] = useState(false);
  const [naverImportText, setNaverImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [sortAlpha, setSortAlpha] = useState(false);

  const filtered = custs
    .filter(c => c.name.includes(q) || c.phone.replace(/-/g,"").includes(q.replace(/-/g,"")))
    .slice()
    .sort((a,b) => sortAlpha ? a.name.localeCompare(b.name,"ko") : 0);

  function parseNaverText(txt) {
    const STATUS = new Set(["완료","취소","확정","대기","노쇼","상태","예약자","전화번호"]);
    const lines = txt.split(/\n/).map(l=>l.split(/\t/)[0].trim()).filter(Boolean);
    const result = new Map();
    for(let i=0; i<lines.length; i++) {
      const phoneM = lines[i].match(/^(010-\d{4}-\d{4})/);
      if(phoneM) {
        const phone = phoneM[1];
        for(let j=i-1; j>=Math.max(0,i-4); j--) {
          const cand = lines[j];
          if(!STATUS.has(cand) && !/^\d/.test(cand) && cand.length>=2 && cand.length<=10 && /[가-힣]/.test(cand)) {
            if(!result.has(phone)) result.set(phone, cand);
            break;
          }
        }
      }
    }
    return Array.from(result.entries()).map(([phone,name])=>({name,phone}));
  }

  async function importParsed() {
    if(!onSaveNew) return;
    const parsed = parseNaverText(naverImportText);
    setImporting(true);
    let added = 0;
    for(const nc of parsed) {
      const exists = CUSTS.find(c=>c.phone.replace(/-/g,"")===nc.phone.replace(/-/g,""));
      if(!exists) {
        const c = {id:Date.now()+added, name:nc.name, phone:nc.phone, birth:"", memo:"", tags:[], visits:0, revenue:0};
        CUSTS = [...CUSTS, c];
        await onSaveNew(c);
        added++;
      }
    }
    setCusts([...CUSTS]);
    setImporting(false);
    setImportResult(added);
    setNaverImportText("");
  }

  function startEdit(cust) {
    setEditData({...cust, tags:[...cust.tags]});
    setEditMode(true);
  }

  function saveEdit() {
    const d = {...editData, visits:Number(editData.visits)||0, revenue:Number(editData.revenue)||0};
    setCusts(p => p.map(c => c.id===d.id ? d : c));
    CUSTS = CUSTS.map(c => c.id===d.id ? d : c);
    if(onSaveNew) onSaveNew(d);
    setSel(d);
    setEditMode(false);
  }

  function togEditTag(t) {
    setEditData(p => ({...p, tags: p.tags.includes(t) ? p.tags.filter(x=>x!==t) : [...p.tags,t]}));
  }

  function addCustomTag() {
    const t = newTag.trim();
    if(!t) return;
    if(!customTags.includes(t)) setCustomTags(p => [...p,t]);
    if(!editData.tags.includes(t)) setEditData(p => ({...p,tags:[...p.tags,t]}));
    setNewTag("");
  }

  if(sel) {
    const hist = BKS.filter(b=>b.name===sel.name && !deletedBkIds.has(b.id)).sort((a,b)=>b.date.localeCompare(a.date));
    const allTags = [...TAGS, ...customTags];

    if(editMode && editData) return (
      <div>
        <div style={{background:WH,padding:"12px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <button onClick={() => setEditMode(false)} style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:13,fontWeight:600}}>취소</button>
          <span style={{fontSize:15,fontWeight:800,color:DK}}>고객 정보 수정</span>
          <button onClick={saveEdit} style={{background:P,border:"none",cursor:"pointer",color:WH,fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:10}}>저장</button>
        </div>
        <div style={{padding:"14px 16px"}}>
          {[{l:"이름",k:"name",t:"text"},{l:"전화번호",k:"phone",t:"tel"},{l:"생년월일",k:"birth",t:"text"}].map(f => (
            <div key={f.k} style={{marginBottom:12}}>
              <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:5}}>{f.l}</div>
              <input value={editData[f.k]||""} onChange={e => setEditData(p => ({...p,[f.k]:f.k==="phone"?fmtPhone(e.target.value):e.target.value}))}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
          ))}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:7}}>태그</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
              {allTags.map(t => (
                <button key={t} onClick={() => togEditTag(t)}
                  style={{padding:"6px 13px",borderRadius:20,border:editData.tags.includes(t)?"none":"1px solid "+G2,background:editData.tags.includes(t)?P:WH,color:editData.tags.includes(t)?WH:G7,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:6}}>
              <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => {if(e.key==="Enter"){e.preventDefault();addCustomTag();}}} placeholder="태그 직접 추가"
                style={{flex:1,padding:"8px 10px",borderRadius:9,border:"1.5px dashed "+PM,fontSize:11,outline:"none",color:DK,background:WH}}/>
              <button onMouseDown={e => {e.preventDefault();addCustomTag();}}
                style={{padding:"8px 12px",borderRadius:9,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer"}}>추가</button>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:5}}>메모</div>
            <textarea value={editData.memo||""} onChange={e => setEditData(p => ({...p,memo:e.target.value}))} placeholder="특이사항, 주의사항 등" rows={4}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,resize:"none",background:WH,boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:5}}>방문횟수</div>
              <input type="number" min="0" value={editData.visits||0} onChange={e => setEditData(p => ({...p,visits:Number(e.target.value)||0}))}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:5}}>누적매출 (원)</div>
              <input type="number" min="0" value={editData.revenue||0} onChange={e => setEditData(p => ({...p,revenue:Number(e.target.value)||0}))}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <>
      <div>
        <div style={{background:WH,padding:"12px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={() => setSel(null)} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:3}}>‹ 고객목록</button>
          <div style={{position:"relative"}}>
            <button onClick={() => setShowCustMenu(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 8px",fontSize:20,color:G5,lineHeight:1}}>⋯</button>
            {showCustMenu && (
              <>
                <div onClick={() => setShowCustMenu(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
                <div style={{position:"absolute",right:0,top:"100%",zIndex:100,background:WH,borderRadius:12,boxShadow:"0 4px 20px rgba(0,0,0,0.13)",border:"1px solid "+G2,minWidth:120,overflow:"hidden"}}>
                  <button onClick={() => {
                    setShowCustMenu(false);
                    const paidEntries = Object.entries(paidBks||{}).filter(([,p])=>p.custName===sel.name);
                    const validEntries = paidEntries.filter(([bkId])=>{ const bk=BKS.find(b=>String(b.id)===String(bkId)||String(b.firestoreId)===String(bkId)); return !bk||(bk.status!=="noshow"&&bk.status!=="cancel"); });
                    const visits = validEntries.length;
                    const revenue = validEntries.reduce((s,[,p])=>s+(p.amount||0),0);
                    if(!window.confirm("방문횟수 "+visits+"회, 누적매출 "+revenue.toLocaleString()+"원으로 재계산할까요?")) return;
                    const updated = {...sel, visits, revenue};
                    setCusts(p=>p.map(c=>c.id===sel.id?updated:c));
                    CUSTS = CUSTS.map(c=>c.id===sel.id?updated:c);
                    if(onSaveNew) onSaveNew(updated);
                    setSel(updated);
                  }} style={{display:"block",width:"100%",padding:"12px 16px",background:"none",border:"none",borderBottom:"1px solid "+G2,textAlign:"left",fontSize:13,color:DK,cursor:"pointer",fontWeight:500}}>재계산</button>
                  <button onClick={() => { setShowCustMenu(false); startEdit(sel); }}
                    style={{display:"block",width:"100%",padding:"12px 16px",background:"none",border:"none",borderBottom:"1px solid "+G2,textAlign:"left",fontSize:13,color:DK,cursor:"pointer",fontWeight:500}}>수정</button>
                  <button onClick={() => { setShowCustMenu(false); if(!window.confirm(sel.name+"님 고객 정보를 삭제할까요?")) return; if(onDeleteCust) onDeleteCust(sel); setCusts(p=>p.filter(c=>c.id!==sel.id)); setSel(null); }}
                    style={{display:"block",width:"100%",padding:"12px 16px",background:"none",border:"none",textAlign:"left",fontSize:13,color:RD,cursor:"pointer",fontWeight:500}}>삭제</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{padding:"12px 14px"}}>
          <div style={{background:WH,borderRadius:17,padding:"16px",marginBottom:11,border:"1px solid "+G2}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:46,height:46,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:700,color:P,flexShrink:0}}>{sel.name[0]}</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:DK}}>{sel.name}</div>
                <div style={{fontSize:12,color:G5}}>{sel.phone}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:9}}>
              {(()=>{
                const prepaidRec=(prepaidData||[]).find(d=>d.custName===sel.name);
                const prepaidBal=prepaidRec?(prepaidRec.balance||0):0;
                return [{l:"방문횟수",v:sel.visits+"회"},{l:"누적매출",v:(sel.revenue/10000).toFixed(0)+"만원"},{l:"선불권",v:prepaidBal.toLocaleString()+"원"}];
              })().map((s,i) => (
                <div key={i} style={{background:PS,borderRadius:10,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:G5,marginBottom:3}}>{s.l}</div>
                  <div style={{fontSize:12,fontWeight:800,color:DK}}>{s.v}</div>
                </div>
              ))}
            </div>
            {(()=>{
              const prepaidRec=(prepaidData||[]).find(d=>d.custName===sel.name);
              const prepaidBal=prepaidRec?(prepaidRec.balance||0):0;
              if(!prepaidBal) return null;
              const lastPaid=hist.filter(b=>paidBks&&paidBks[b.id]).sort((a,b)=>b.date.localeCompare(a.date))[0];
              const td=new Date();
              const dateStr=lastPaid?lastPaid.date.slice(5).replace('-','.'):`${td.getMonth()+1}.${td.getDate()}`;
              const svcStr=lastPaid?(lastPaid.svc||''):'';
              const amtStr=lastPaid?((paidBks[lastPaid.id].amount||0).toLocaleString()):'';
              const body=`루미네일 (${sel.name}님)\n${dateStr} ${svcStr} ${amtStr}원 사용\n잔액 ${prepaidBal.toLocaleString()}원\n감사합니다. ♥`;
              const phone=sel.phone.replace(/-/g,'');
              return (
                <button onClick={()=>setSmsEdit({phone, body})}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px",borderRadius:11,background:PL,border:"1px solid "+PM,color:P,fontSize:12,fontWeight:700,marginBottom:9,cursor:"pointer",width:"100%"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  선불권 잔액 안내 문자
                </button>
              );
            })()}
            {sel.tags.length>0 && (
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
                {sel.tags.map(t => <span key={t} style={{padding:"2px 8px",borderRadius:20,background:PL,fontSize:10,color:P,fontWeight:600}}>{t}</span>)}
              </div>
            )}
            {sel.memo && <div style={{padding:"8px 10px",background:BG,borderRadius:8,fontSize:11,color:G7}}>{sel.memo}</div>}
          </div>
          <div style={{fontSize:13,fontWeight:700,color:DK,marginBottom:7}}>방문 이력</div>
          {hist.length===0 ? (
            <div style={{textAlign:"center",padding:"24px",color:G5,fontSize:12}}>방문 이력 없음</div>
          ) : hist.map(b => (
            <div key={b.id}
              onClick={() => setSelVisit(b)}
              style={{background:b.status==="cancel"?G2:b.status==="noshow"?RD+"12":WH,borderRadius:11,padding:"11px 13px",marginBottom:6,border:"1px solid "+(b.status==="cancel"?G5:b.status==="noshow"?RD+"50":G2),cursor:"pointer",opacity:b.status==="cancel"?0.7:1}}>
              {(()=>{
                const paid=paidBks&&paidBks[b.id];
                const hasDeposit=(b.depAmt||0)>0;
                const isNoshow=b.status==="noshow";
                const isCancel=b.status==="cancel";
                const amtLabel = paid
                  ? (paidBks[b.id].amount||0).toLocaleString()+"원"
                  : hasDeposit
                    ? (b.depAmt||0).toLocaleString()+"원"
                    : b.price.toLocaleString()+"원";
                const amtColor = isNoshow||isCancel ? G5 : paid ? OR : G5;
                const badge = isCancel
                  ? {label:"취소",bg:G3,color:G5}
                  : isNoshow
                    ? {label:"노쇼",bg:RD+"25",color:RD}
                    : paid ? null : hasDeposit
                      ? {label:"잔금 대기",bg:"#FFF3E0",color:"#E65100"}
                      : {label:"미결제",bg:"#F5F5F5",color:G5};
                return (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:700,color:isCancel?G5:DK,textDecoration:isCancel?"line-through":"none"}}>{b.date}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {badge&&<span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:badge.bg,color:badge.color}}>{badge.label}</span>}
                      {!isNoshow&&!isCancel&&<span style={{fontSize:12,fontWeight:700,color:amtColor}}>{amtLabel}</span>}
                      {!paid&&!isNoshow&&!isCancel&&<button onClick={e=>{e.stopPropagation();if(!window.confirm("이 방문 기록을 삭제할까요?"))return;setDeletedBkIds(prev=>new Set([...prev,b.id]));if(onDeleteBooking)onDeleteBooking(b);}} style={{background:"none",border:"none",cursor:"pointer",color:RD,fontSize:16,padding:"0 2px",lineHeight:1,flexShrink:0}}>×</button>}
                      {paid&&!isNoshow&&!isCancel&&<span style={{fontSize:11,color:G5}}>›</span>}
                    </div>
                  </div>
                );
              })()}
              <div style={{fontSize:11,color:G5}}>담당자{b.sid+1} · {b.svc}</div>
              {b.photos&&b.photos.length>0 && (
                <div style={{display:"flex",gap:5,marginTop:6}}>
                  {b.photos.slice(0,3).map(ph => (
                    <img key={ph.id} src={ph.url} alt="시술사진" style={{width:40,height:40,borderRadius:6,objectFit:"cover"}}/>
                  ))}
                  {b.photos.length>3 && <div style={{width:40,height:40,borderRadius:6,background:G2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:G5}}>+{b.photos.length-3}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 방문 이력 상세 팝업 */}
      {selVisit && (
        <Sheet onClose={() => setSelVisit(null)} maxH="85vh">
          <SheetHandle title="시술 상세" onClose={() => setSelVisit(null)}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 18px 36px"}}>
            {/* 고객 + 날짜 요약 */}
            <div style={{background:PL,borderRadius:12,padding:"12px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:DK}}>{sel.name}</div>
                <div style={{fontSize:11,color:G5,marginTop:2}}>{selVisit.date}</div>
              </div>
              <div style={{fontSize:16,fontWeight:800,color:P}}>{(paidBks&&paidBks[selVisit.id]?paidBks[selVisit.id].amount:selVisit.price).toLocaleString()}원</div>
            </div>

            {/* 시술 정보 */}
            {[
              {l:"날짜",     v:selVisit.date},
              {l:"시간",     v:selVisit.time+" ~ "+endTime(selVisit.time,selVisit.mins)},
              {l:"시술",     v:selVisit.svc},
              {l:"시술시간", v:selVisit.mins+"분"},
              {l:"담당자",   v:"담당자"+(selVisit.sid+1)},
            ].map((r,i) => (
              <div key={i} style={{display:"flex",padding:"11px 0",borderBottom:"1px solid "+G2}}>
                <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>{r.l}</span>
                <span style={{fontSize:13,fontWeight:600,color:DK}}>{r.v}</span>
              </div>
            ))}

            {/* 금액 블록 */}
            {(()=>{
              const paid=paidBks&&paidBks[selVisit.id];
              const svcAmt=paid?paid.amount:selVisit.price;
              const depA=selVisit.depAmt||0;
              return (
                <div style={{margin:"8px 0",borderRadius:12,border:"1px solid "+G2,overflow:"hidden"}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderBottom:"1px solid "+G2}}>
                    <span style={{fontSize:12,color:G5}}>시술 금액</span>
                    <span style={{fontSize:14,fontWeight:700,color:DK}}>{svcAmt.toLocaleString()}원</span>
                  </div>
                  {depA>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderBottom:"1px solid "+G2,background:PS}}>
                      <span style={{fontSize:12,color:G5}}>예약금</span>
                      <span style={{fontSize:13,fontWeight:700,color:GR}}>−{depA.toLocaleString()}원</span>
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",background:PL}}>
                    <span style={{fontSize:13,fontWeight:700,color:DK}}>{depA>0?"잔금":"결제금액"}</span>
                    <span style={{fontSize:15,fontWeight:800,color:P}}>{Math.max(0,svcAmt-depA).toLocaleString()}원</span>
                  </div>
                </div>
              );
            })()}

            {/* 예약금 수단 */}
            {selVisit.dep && selVisit.dep !== "unpaid" && (
              <div style={{display:"flex",padding:"11px 0",borderBottom:"1px solid "+G2}}>
                <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>예약금 수단</span>
                <span style={{fontSize:13,fontWeight:600,color:DK}}>
                  {selVisit.dep==="naver_paid"?"N페이":selVisit.dep==="naver"?"N페이":selVisit.dep==="paid"?"완료":selVisit.dep==="transfer"?"계좌이체":selVisit.dep==="cash"?"현금":selVisit.dep==="card"?"카드":selVisit.dep}
                </span>
              </div>
            )}
            {/* 결제 수단 */}
            {paidBks&&paidBks[selVisit.id] && (
              <div style={{display:"flex",padding:"11px 0",borderBottom:"1px solid "+G2}}>
                <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>결제 수단</span>
                <div>
                  <span style={{fontSize:13,fontWeight:700,color:OR}}>{paidBks[selVisit.id].method}</span>
                  {(paidBks[selVisit.id].chargeBonus||0)>0 && (
                    <div style={{fontSize:11,color:OR,marginTop:1}}>(+보너스 {(paidBks[selVisit.id].chargeBonus).toLocaleString()}원)</div>
                  )}
                </div>
              </div>
            )}

            {/* 시술 메모 */}
            {selVisit.treatmentNotes && (
              <div style={{marginTop:12,padding:"11px 13px",borderRadius:10,background:PS,border:"1px solid "+G2}}>
                <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:5}}>시술 메모</div>
                <div style={{fontSize:13,color:DK,lineHeight:1.6}}>{selVisit.treatmentNotes}</div>
              </div>
            )}

            {/* 사용 제품 */}
            {selVisit.usedProduct && (
              <div style={{marginTop:10,padding:"11px 13px",borderRadius:10,background:PS,border:"1px solid "+G2}}>
                <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:5}}>사용 제품</div>
                <div style={{fontSize:13,color:DK}}>{selVisit.usedProduct}</div>
              </div>
            )}

            {/* 네일 컨디션 */}
            {selVisit.condition && (
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:G5}}>네일 컨디션</span>
                <span style={{padding:"3px 12px",borderRadius:20,background:PL,fontSize:12,fontWeight:600,color:P}}>{selVisit.condition}</span>
              </div>
            )}

            {/* 다음 방문 예정 */}
            {selVisit.nextVisit && (
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:G5}}>다음 방문</span>
                <span style={{fontSize:12,fontWeight:600,color:DK}}>{selVisit.nextVisit}</span>
              </div>
            )}

            {/* 시술 사진 */}
            {selVisit.photos && selVisit.photos.length > 0 && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:8}}>시술 사진</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {selVisit.photos.map(ph => (
                    <img key={ph.id} src={ph.url} alt="시술사진"
                      style={{width:88,height:88,borderRadius:10,objectFit:"cover",border:"1px solid "+G2}}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}
      </>
    );
  }

  return (
    <div>
      <div style={{padding:"10px 13px",background:WH,borderBottom:"1px solid "+G2}}>
        <div style={{display:"flex",gap:7}}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름 또는 전화번호"
            style={{flex:1,padding:"8px 10px",borderRadius:10,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
          <button onClick={() => setShowR(true)}
            style={{padding:"8px 13px",borderRadius:10,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ 신규</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{fontSize:10,color:G5}}>총 {custs.length}명</div>
            <button onClick={()=>setSortAlpha(v=>!v)}
              style={{padding:"2px 8px",borderRadius:7,background:sortAlpha?P:WH,border:"1px solid "+(sortAlpha?P:G2),color:sortAlpha?WH:G5,fontSize:10,fontWeight:600,cursor:"pointer"}}>
              가나다순
            </button>
          </div>
          <button onClick={()=>{setShowNaverImport(v=>!v);setImportResult(null);}}
            style={{padding:"3px 9px",borderRadius:8,background:showNaverImport?G2:WH,border:"1px solid "+G2,color:G7,fontSize:11,fontWeight:600,cursor:"pointer"}}>
            N 고객 가져오기
          </button>
        </div>
        {showNaverImport && (
          <div style={{marginTop:8,padding:"10px 12px",background:"#F5F3FC",borderRadius:12}}>
            <textarea value={naverImportText} onChange={e=>{setNaverImportText(e.target.value);setImportResult(null);}}
              placeholder={"네이버 예약관리 페이지에서 Ctrl+A → Ctrl+C 후 여기에 붙여넣기"}
              rows={5} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1.5px solid "+G2,fontSize:11,outline:"none",color:DK,background:WH,boxSizing:"border-box",resize:"vertical"}}/>
            {naverImportText && (
              <div style={{fontSize:11,color:G5,marginTop:5}}>
                인식된 고객: <b style={{color:P}}>{parseNaverText(naverImportText).length}명</b>
                {" ("}기존 제외 시 {parseNaverText(naverImportText).filter(nc=>!CUSTS.find(c=>c.phone.replace(/-/g,"")===nc.phone.replace(/-/g,""))).length}명 신규{")"}
              </div>
            )}
            {importResult!==null && <div style={{fontSize:12,color:P,fontWeight:700,marginTop:5}}>✓ {importResult}명 등록 완료</div>}
            <button onClick={importParsed} disabled={importing||!naverImportText}
              style={{marginTop:8,width:"100%",padding:"10px",borderRadius:10,background:importing||!naverImportText?G2:P,border:"none",color:importing||!naverImportText?G5:WH,fontSize:13,fontWeight:700,cursor:importing||!naverImportText?"not-allowed":"pointer"}}>
              {importing ? "등록 중..." : "고객 등록"}
            </button>
          </div>
        )}
      </div>
      <div style={{padding:"7px 13px"}}>
        {filtered.map(c => (
          <div key={c.id} onClick={() => setSel(c)}
            style={{background:WH,borderRadius:13,padding:"11px 13px",marginBottom:6,display:"flex",alignItems:"center",gap:10,border:"1px solid "+G2,cursor:"pointer"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:P,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                <span style={{fontSize:13,fontWeight:700,color:DK}}>{c.name}{c.phone&&<span style={{fontSize:11,fontWeight:400,color:G5}}> ···{c.phone.replace(/-/g,"").slice(-4)}</span>}</span>
                {c.tags.slice(0,2).map(t => <span key={t} style={{fontSize:9,padding:"1px 5px",borderRadius:7,background:PL,color:P,fontWeight:600}}>{t}</span>)}
              </div>
              <span style={{fontSize:11,color:G5}}>{c.phone} · {c.visits}회</span>
            </div>
          </div>
        ))}
      </div>
      {showR && (
        <Sheet onClose={() => setShowR(false)} maxH="85vh">
          <div style={{overflowY:"auto",flex:1,padding:"0 18px 36px"}}>
            <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"12px auto 14px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <span style={{fontSize:15,fontWeight:800,color:DK}}>신규 고객 등록</span>
              <button onClick={() => setShowR(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
            </div>
            {[{l:"이름 *",k:"name",p:"홍길동",t:"text"},{l:"전화번호",k:"phone",p:"010-0000-0000",t:"tel"}].map(f => (
              <div key={f.k} style={{marginBottom:11}}>
                <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:4}}>{f.l}</div>
                <input value={nc[f.k]} onChange={e => setNc(p => ({...p,[f.k]:f.k==="phone"?fmtPhone(e.target.value):e.target.value}))}
                  placeholder={f.p} type={f.t}
                  style={{width:"100%",padding:"10px 11px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{marginBottom:11}}>
              <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:6}}>태그</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {TAGS.map(t => {
                  const on = nc.tags.includes(t);
                  return <Pill key={t} on={on} onClick={() => setNc(p => ({...p,tags:on?p.tags.filter(x=>x!==t):[...p.tags,t]}))}>{t}</Pill>;
                })}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:4}}>메모</div>
              <textarea value={nc.memo} onChange={e => setNc(p => ({...p,memo:e.target.value}))} placeholder="특이사항" rows={2}
                style={{width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid "+G2,fontSize:11,outline:"none",color:DK,resize:"none",background:WH,boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            <button onMouseDown={e => {
              e.preventDefault();
              if(!nc.name.trim()) return;
              const c = {id:Date.now(),...nc,visits:0,revenue:0};
              CUSTS = [...CUSTS,c];
              setCusts(p => [...p,c]);
              if(onSaveNew) onSaveNew(c);
              setShowR(false);
              setNc({name:"",phone:"",memo:"",tags:[]});
            }} style={{width:"100%",padding:"13px",borderRadius:13,background:P,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>등록 완료</button>
          </div>
        </Sheet>
      )}
      {smsEdit && (
        <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:430,background:WH,borderRadius:"22px 22px 0 0",padding:"22px 18px 44px"}}>
            <div style={{fontSize:14,fontWeight:700,color:DK,marginBottom:10}}>문자 내용 확인 · 수정</div>
            <textarea value={smsEdit.body} onChange={e=>setSmsEdit(v=>({...v,body:e.target.value}))}
              style={{width:"100%",minHeight:90,padding:"12px",borderRadius:11,border:"1.5px solid "+G2,fontSize:13,color:DK,background:BG,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.7,fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>setSmsEdit(null)} style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:13,fontWeight:600,cursor:"pointer"}}>취소</button>
              <a href={`sms:${smsEdit.phone}&body=${encodeURIComponent(smsEdit.body)}`}
                onClick={()=>setTimeout(()=>setSmsEdit(null),300)}
                style={{flex:2,padding:"13px",borderRadius:13,background:P,color:WH,fontSize:13,fontWeight:700,textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WH} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                문자 보내기
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 매출 페이지 ───────────────────────────────────────
function SalesPage({ paidBks, onDeletePaid }) {
  const [showDetail, setShowDetail] = useState(null); // "today" | "month"
  const curMonth = TODAY.slice(0,7);
  const allEntries = Object.entries(paidBks||{});
  const todayEntries = allEntries.filter(([,p])=>p.date===TODAY);
  const monthEntries = allEntries.filter(([,p])=>p.date&&p.date.slice(0,7)===curMonth);
  const total = monthEntries.reduce((s,[,p])=>s+(p.amount||0),0);
  const td = todayEntries.reduce((s,[,p])=>s+(p.amount||0),0);
  const byS = [0,1].map(id => {
    const me = monthEntries.filter(([bkId])=>{ const b=BKS.find(x=>String(x.id)===bkId); return b&&b.sid===id; });
    return { n:"담당자"+(id+1), r:me.reduce((s,[,p])=>s+(p.amount||0),0), c:me.length };
  });

  // 상세 시트용 데이터 계산
  function getDetail(entries) {
    const totalAmt = entries.reduce((s,[,p])=>s+(p.amount||0),0);
    // 결제수단별
    const methodMap = {};
    entries.forEach(([,p])=>{
      const m = p.method&&p.method.includes("선불권 충전")?"선불권 충전":p.method||"기타";
      if(!methodMap[m]) methodMap[m]={r:0,c:0};
      methodMap[m].r+=(p.amount||0); methodMap[m].c+=1;
    });
    const byMethod = Object.entries(methodMap).sort((a,b)=>b[1].r-a[1].r);
    // 담당자별
    const staffMap = {};
    entries.forEach(([bkId,p])=>{
      const b=BKS.find(x=>String(x.id)===bkId);
      const sn = b?"담당자"+(b.sid+1):(p.custName?"":"-");
      if(!staffMap[sn]) staffMap[sn]={r:0,c:0};
      staffMap[sn].r+=(p.amount||0); staffMap[sn].c+=1;
    });
    const byStaff = Object.entries(staffMap).sort((a,b)=>b[1].r-a[1].r);
    // 건별 내역
    const list = entries.map(([bkId,p])=>{
      const b=BKS.find(x=>String(x.id)===bkId);
      return {bkId,name:p.custName||b?.name||"-",svc:b?.svc||"-",time:b?.time||"",date:p.date,method:p.method,amount:p.amount||0};
    }).sort((a,b)=>a.date===b.date?a.time.localeCompare(b.time):b.date.localeCompare(a.date));
    return {totalAmt,byMethod,byStaff,list};
  }

  const det = showDetail ? getDetail(showDetail==="today"?todayEntries:monthEntries) : null;

  return (
    <div style={{padding:"12px 13px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
        {[
          {l:"오늘 매출",v:td.toLocaleString(),s:`${new Date().getMonth()+1}월 ${new Date().getDate()}일`,key:"today"},
          {l:"이번달 매출",v:total.toLocaleString(),s:`${new Date().getMonth()+1}월 전체`,key:"month"},
        ].map(c => (
          <div key={c.key} onClick={()=>setShowDetail(c.key)}
            style={{background:WH,borderRadius:14,padding:"13px",border:"1px solid "+G2,cursor:"pointer"}}>
            <div style={{fontSize:10,color:G5,marginBottom:4}}>{c.l} ›</div>
            <div style={{fontSize:18,fontWeight:800,color:DK}}>{c.v}</div>
            <div style={{fontSize:9,color:G5,marginTop:2}}>{c.s}</div>
          </div>
        ))}
      </div>
      <div style={{background:WH,borderRadius:14,padding:"13px",border:"1px solid "+G2,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:DK,marginBottom:10}}>담당자별 매출 <span style={{fontSize:10,color:G5,fontWeight:400}}>이번달</span></div>
        {byS.map((s,i) => (
          <div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:11,fontWeight:600,color:DK}}>{s.n}</span>
              <span style={{fontSize:11,fontWeight:700,color:P}}>{s.r.toLocaleString()}원 ({s.c}건)</span>
            </div>
            <div style={{height:5,background:G2,borderRadius:3}}>
              <div style={{width:total>0?(s.r/total*100).toFixed(0)+"%":"0%",height:"100%",background:P,borderRadius:3}}/>
            </div>
          </div>
        ))}
      </div>

      {/* 매출 상세 시트 */}
      {showDetail && det && (
        <Sheet onClose={()=>setShowDetail(null)} maxH="88vh">
          <SheetHandle title={showDetail==="today"?"오늘 매출 상세":"이번달 매출 상세"} onClose={()=>setShowDetail(null)}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 16px 40px"}}>
            {/* 총 매출 */}
            <div style={{background:P,borderRadius:16,padding:"18px 20px",marginBottom:16,color:WH}}>
              <div style={{fontSize:11,opacity:0.8,marginBottom:6}}>{showDetail==="today"?`${new Date().getMonth()+1}월 ${new Date().getDate()}일`:`${new Date().getMonth()+1}월 전체`} · {det.list.length}건</div>
              <div style={{fontSize:26,fontWeight:800}}>{det.totalAmt.toLocaleString()}원</div>
            </div>

            {/* 결제수단별 - 도넛 차트 */}
            <div style={{background:WH,borderRadius:14,padding:"14px",border:"1px solid "+G2,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:DK,marginBottom:12}}>결제수단별</div>
              {det.byMethod.length===0
                ? <div style={{fontSize:12,color:G5,textAlign:"center",padding:"8px 0"}}>내역 없음</div>
                : (() => {
                    const COLORS=[P,OR,GR,"#FF9500","#5856D6","#FF6B6B"];
                    const total=det.totalAmt;
                    const r=50, cx=65, cy=65, circ=2*Math.PI*r;
                    let cumAngle=-90;
                    return (
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <svg width={130} height={130} style={{flexShrink:0}}>
                          <circle cx={cx} cy={cy} r={r} fill="none" stroke={G2} strokeWidth={20}/>
                          {det.byMethod.map(([m,v],i)=>{
                            const pct=total>0?v.r/total:0;
                            const dash=pct*circ;
                            const sa=cumAngle;
                            cumAngle+=pct*360;
                            return <circle key={m} cx={cx} cy={cy} r={r} fill="none" stroke={COLORS[i%COLORS.length]} strokeWidth={20} strokeDasharray={`${dash} ${circ-dash}`} transform={`rotate(${sa} ${cx} ${cy})`}/>;
                          })}
                          <text x={cx} y={cy-5} textAnchor="middle" style={{fontSize:13,fontWeight:"bold",fill:DK}}>{total>=10000?(total/10000).toFixed(0)+"만":total.toLocaleString()}</text>
                          <text x={cx} y={cy+11} textAnchor="middle" style={{fontSize:9,fill:G5}}>원</text>
                        </svg>
                        <div style={{flex:1}}>
                          {det.byMethod.map(([m,v],i)=>(
                            <div key={m} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                              <div style={{width:9,height:9,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,color:DK,fontWeight:600}}>{m}</div>
                                <div style={{fontSize:10,color:G5}}>{v.c}건</div>
                              </div>
                              <span style={{fontSize:11,fontWeight:700,color:COLORS[i%COLORS.length]}}>{v.r.toLocaleString()}원</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
              }
            </div>

            {/* 담당자별 */}
            <div style={{background:WH,borderRadius:14,padding:"14px",border:"1px solid "+G2,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:DK,marginBottom:10}}>담당자별</div>
              {det.byStaff.map(([sn,v])=>(
                <div key={sn} style={{marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:12,color:DK}}>{sn}</span>
                    <span style={{fontSize:12,fontWeight:700,color:P}}>{v.r.toLocaleString()}원 ({v.c}건)</span>
                  </div>
                  <div style={{height:4,background:G2,borderRadius:2}}>
                    <div style={{width:det.totalAmt>0?(v.r/det.totalAmt*100).toFixed(0)+"%":"0%",height:"100%",background:P,borderRadius:2}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* 건별 내역 */}
            <div style={{background:WH,borderRadius:14,padding:"14px",border:"1px solid "+G2}}>
              <div style={{fontSize:12,fontWeight:700,color:DK,marginBottom:10}}>결제 내역</div>
              {det.list.length===0
                ? <div style={{fontSize:12,color:G5,textAlign:"center",padding:"8px 0"}}>내역 없음</div>
                : det.list.map(item=>(
                  <div key={item.bkId} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+G2}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                        <span style={{fontSize:13,fontWeight:700,color:DK}}>{item.name}</span>
                        {item.time&&<span style={{fontSize:11,color:G5}}>{item.time}</span>}
                      </div>
                      <div style={{fontSize:11,color:G5}}>{item.svc} · {item.method}</div>
                      {showDetail==="month"&&<div style={{fontSize:10,color:G5,marginTop:1}}>{item.date}</div>}
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:P}}>{item.amount.toLocaleString()}원</span>
                    {onDeletePaid && <button onClick={()=>{if(window.confirm("이 결제 내역을 삭제할까요?"))onDeletePaid(item.bkId);}} style={{marginLeft:10,background:"none",border:"none",cursor:"pointer",color:RD,fontSize:18,padding:"0 2px",lineHeight:1}}>×</button>}
                  </div>
                ))
              }
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ── 홈 페이지 ─────────────────────────────────────────
function HomePage({ onDate, staff, onPay, paidBks, onCancelPay, slotUnit=30, onDelete, onDeletePaid, onUpdate }) {
  const [fs, setFs] = useState(null);
  const [showSales, setShowSales] = useState(null);
  const [showBk, setShowBk] = useState(null);
  const [smsEdit, setSmsEdit] = useState(null);
  const [editBk, setEditBk] = useState(null);
  const [delConfirmBk, setDelConfirmBk] = useState(null);
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [swipeMap, setSwipeMap] = useState({});
  const [swipeTouchX, setSwipeTouchX] = useState({});
  const [selDate, setSelDate] = useState(TODAY);
  const todB = BKS.filter(b=>b.date===selDate).sort((a,b)=>a.time.localeCompare(b.time));
  const fil = fs===null ? todB : todB.filter(b=>b.sid===fs);
  const rev = Object.values(paidBks).filter(p=>p.date===TODAY).reduce((s,p)=>s+(p.amount||p.paidAmt||0),0);
  const mrev = Object.values(paidBks).filter(p=>p.date&&p.date.slice(0,7)===TODAY.slice(0,7)).reduce((s,p)=>s+(p.amount||p.paidAmt||0),0);
  const salesDateGroups = Object.entries(paidBks).filter(([_,p])=>p.date).reduce((acc,[id,p])=>{const d=p.date;if(!acc[d])acc[d]=[];acc[d].push([id,p]);return acc;},{});
  const salesDateKeys = Object.keys(salesDateGroups).sort((a,b)=>b.localeCompare(a));

  const _tn = new Date();
  const _tyr = _tn.getFullYear(), _tmo = _tn.getMonth()+1, _td = _tn.getDate();
  const _dim = new Date(_tyr, _tmo, 0).getDate();
  const calD = Array.from({length:_dim},(_,i) => {
    const d=i+1;
    const ds=_tyr+"-"+String(_tmo).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const dow=new Date(_tyr,_tmo-1,d).getDay();
    return {d,ds,isT:d===_td,we:dow===0||dow===6,cnt:BKS.filter(b=>b.date===ds).length};
  });

  const depLabel = dep => {
    if(dep==="naver_paid") return "N페이 + 예약금";
    if(dep==="naver")      return "N페이";
    if(dep==="paid")       return "예약금 완료";
    if(dep==="unpaid")     return "미납";
    if(dep==="transfer")   return "계좌이체";
    if(dep==="cash")       return "현금";
    if(dep==="card")       return "카드";
    if(dep==="etc")        return "기타";
    return dep || "미납";
  };

  return (
    <div>
      <div style={{background:WH,padding:"0 14px 14px",borderBottom:"1px solid "+G2}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,paddingTop:13}}>
          <div style={{background:P,borderRadius:15,padding:"11px",boxShadow:"0 5px 15px "+P+"40"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginBottom:3}}>오늘 예약</div>
            <div style={{fontSize:20,fontWeight:800,color:WH}}>{todB.length}<span style={{fontSize:11}}>건</span></div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",marginTop:4,lineHeight:1.8}}>확정 {todB.filter(b=>b.dep!=="unpaid").length}<br/>대기 {todB.filter(b=>b.dep==="unpaid").length}</div>
          </div>
          <div onClick={() => setShowSales("today")} style={{background:WH,borderRadius:15,padding:"11px",border:"1px solid "+G2,cursor:"pointer"}}>
            <div style={{fontSize:9,color:G5,marginBottom:3}}>오늘 매출 ›</div>
            <div style={{fontSize:17,fontWeight:800,color:DK}}>{rev.toLocaleString()}</div>
          </div>
          <div onClick={() => setShowSales("month")} style={{background:WH,borderRadius:15,padding:"11px",border:"1px solid "+G2,cursor:"pointer"}}>
            <div style={{fontSize:9,color:G5,marginBottom:3}}>이번달 ›</div>
            <div style={{fontSize:17,fontWeight:800,color:DK}}>{mrev.toLocaleString()}</div>
            <div style={{marginTop:5,marginBottom:4,height:3,background:G2,borderRadius:2}}>
              <div style={{width:Math.min(mrev/8000000*100,100).toFixed(0)+"%",height:"100%",background:P,borderRadius:2}}/>
            </div>
            <div style={{fontSize:9,color:G5}}>목표 8,000,000원</div>
          </div>
        </div>
      </div>

      <div style={{padding:"12px 13px 0"}}>
        {(()=>{
          const expiring=PREPAID_DATA.filter(d=>{const dl=daysLeft(d.expiry);return dl!==null&&dl<=30;}).sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));
          if(!expiring.length) return null;
          return (
            <div style={{background:"#FFF8E7",borderRadius:14,padding:"12px 14px",marginBottom:12,border:"1px solid #FFD93D"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#B8860B",marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                선불권 만료 임박 {expiring.length}명
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {expiring.map(d=>{
                  const dl=daysLeft(d.expiry);
                  return (
                    <span key={d.custId} style={{fontSize:11,fontWeight:700,color:dl<=7?RD:"#B8860B",background:dl<=7?"#FFE0E0":"#FFF3CD",borderRadius:6,padding:"3px 9px"}}>
                      {d.custName} {dl<=0?"만료":dl<=7?"D-"+dl+" ⚠":"D-"+dl}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div style={{background:WH,borderRadius:18,padding:"15px",marginBottom:12,border:"1px solid "+G2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
            <span style={{fontSize:15,fontWeight:800,color:DK}}>{_tyr}년 {_tmo}월</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
            {["일","월","화","수","목","금","토"].map((d,i) => <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:600,color:i===0||i===6?RD:G5}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {Array.from({length:new Date(_tyr,_tmo-1,1).getDay()}).map((_,i)=><div key={"e"+i}/>)}
            {calD.map(({d,ds,isT,we,cnt}) => {
              const isHol=!!HOLS[ds],isRed=we||isHol;
              const isSel=ds===selDate;
              return (
                <div key={d} onClick={() => setSelDate(ds)}
                  style={{aspectRatio:"1",borderRadius:9,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background:isSel?P:isT?"#EDE8F8":"transparent",cursor:"pointer",
                    border:isT&&!isSel?"1.5px solid "+P:"none"}}>
                  <span style={{fontSize:16,fontWeight:isSel||isT?700:cnt>0?600:400,color:isSel?WH:isRed?RD:G7}}>{d}</span>
                  {cnt>0&&<div style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.7)":P,marginTop:1}}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          {(() => {
            const sd=new Date(selDate+"T00:00:00");
            return <span style={{fontSize:15,fontWeight:800,color:DK}}>{sd.getMonth()+1}월 {sd.getDate()}일 ({["일","월","화","수","목","금","토"][sd.getDay()]}) · {todB.length}건</span>;
          })()}
          {selDate!==TODAY&&<button onClick={()=>setSelDate(TODAY)} style={{background:"none",border:"1px solid "+G3,borderRadius:8,padding:"3px 9px",fontSize:10,color:G5,cursor:"pointer"}}>오늘</button>}
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto"}}>
          {[{id:null,name:"전체"},...staff].map(s => {
            const on=fs===s.id;
            return <button key={s.id??"all"} onClick={() => setFs(on?null:s.id)}
              style={{padding:"5px 12px",borderRadius:20,border:on?"none":"1px solid "+G2,background:on?P:WH,color:on?WH:G5,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{s.name}</button>;
          })}
        </div>

        {fil.map(b => {
          const swipeX=swipeMap[b.id]||0;
          const isPaid=!!paidBks[b.id];
          const bStatus=b.status;
          const isCancel=bStatus==="cancel";
          const isNoshow=bStatus==="noshow";
          const cardBg=isCancel?G2:isNoshow?"#FFF0F0":isPaid?"#F2FCF6":WH;
          const cardBorder=isCancel?G5:isNoshow?RD+"60":isPaid?GR+"60":G2;
          const accentColor=isCancel?G5:isNoshow?RD:isPaid?GR:P;
          return (
            <div key={b.id} style={{position:"relative",marginBottom:7,overflow:"hidden",borderRadius:13}}
              onTouchStart={e => setSwipeTouchX(p => ({...p,[b.id]:e.touches[0].clientX}))}
              onTouchMove={e => {
                const dx=e.touches[0].clientX-(swipeTouchX[b.id]||0);
                if(dx<0) setSwipeMap(p => ({...p,[b.id]:Math.max(dx,-180)}));
                else if(swipeX<0) setSwipeMap(p => ({...p,[b.id]:Math.min(dx+swipeX,0)}));
              }}
              onTouchEnd={() => {
                if(swipeX<-40) setSwipeMap(p => ({...p,[b.id]:-180}));
                else setSwipeMap(p => ({...p,[b.id]:0}));
              }}>
              <div style={{position:"absolute",right:0,top:0,bottom:0,width:180,display:"flex",borderRadius:"0 13px 13px 0",overflow:"hidden"}}>
                <button onClick={()=>{
                  const ns=isNoshow?undefined:"noshow";
                  if(onUpdate) onUpdate(b,{status:ns});
                  const idx=BKS.findIndex(x=>x.id===b.id);
                  if(idx>=0) BKS[idx]={...BKS[idx],status:ns};
                  setSwipeMap(p=>({...p,[b.id]:0}));
                }} style={{flex:1,border:"none",background:RD,color:WH,fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,opacity:isNoshow?1:0.85}}>
                  <span style={{fontSize:12,fontWeight:700}}>{isNoshow?"✓":"N"}</span>
                  {isNoshow?"해제":"노쇼"}
                </button>
                <button onClick={()=>{
                  const ns=isCancel?undefined:"cancel";
                  if(onUpdate) onUpdate(b,{status:ns});
                  const idx=BKS.findIndex(x=>x.id===b.id);
                  if(idx>=0) BKS[idx]={...BKS[idx],status:ns};
                  setSwipeMap(p=>({...p,[b.id]:0}));
                }} style={{flex:1,border:"none",background:G5,color:WH,fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,opacity:isCancel?1:0.85}}>
                  <span style={{fontSize:13}}>{isCancel?"✓":"✕"}</span>
                  {isCancel?"해제":"취소"}
                </button>
                <button onClick={()=>{if(!isPaid&&onPay){onPay(b);setSwipeMap(p=>({...p,[b.id]:0}));}}}
                  style={{flex:1,border:"none",background:P,color:WH,fontSize:10,fontWeight:700,cursor:isPaid?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                  <span style={{fontSize:12,fontWeight:700}}>{isPaid?"✓":"₩"}</span>
                  {isPaid?"완료":"결제"}
                </button>
              </div>
              <div onClick={() => {setSwipeMap(p => ({...p,[b.id]:0}));setShowBk(b);}}
                style={{background:cardBg,borderRadius:13,padding:"12px 13px",display:"flex",alignItems:"center",border:"1px solid "+cardBorder,cursor:"pointer",transform:"translateX("+swipeX+"px)",transition:swipeTouchX[b.id]?"none":"transform 0.2s",position:"relative",zIndex:1,width:"100%",boxSizing:"border-box"}}>
                <div style={{width:3,alignSelf:"stretch",background:accentColor,borderRadius:2,marginRight:11,flexShrink:0}}/>
                <div style={{minWidth:44}}>
                  <span style={{fontSize:15,fontWeight:800,color:accentColor}}>{b.time}</span>
                </div>
                <div style={{marginRight:6}}><Badge dep={b.dep}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:isCancel?G5:isNoshow?RD:isPaid?GR:DK,textDecoration:isCancel?"line-through":"none"}}>
                    {b.name}
                    {isPaid&&!isCancel&&!isNoshow&&<span style={{fontSize:9,color:GR,fontWeight:600,marginLeft:6}}>결제완료</span>}
                    {isCancel&&<span style={{fontSize:9,color:G5,fontWeight:700,marginLeft:6,background:G3,padding:"1px 5px",borderRadius:4}}>취소</span>}
                    {isNoshow&&<span style={{fontSize:9,color:RD,fontWeight:700,marginLeft:6,background:RD+"20",padding:"1px 5px",borderRadius:4}}>노쇼</span>}
                  </div>
                  <div style={{fontSize:10,color:G5}}>담당자{b.sid+1} · {b.svc}</div>
                </div>
                <span style={{fontSize:12,fontWeight:600,color:accentColor}}>{isPaid?(paidBks[b.id].amount||paidBks[b.id].paidAmt||0).toLocaleString():b.price.toLocaleString()}원</span>
              </div>
            </div>
          );
        })}
      </div>

      {showSales === "today" && (
        <Sheet onClose={() => setShowSales(null)} maxH="85vh">
          <SheetHandle title="매출 내역" onClose={() => setShowSales(null)}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 18px 40px"}}>
            {salesDateKeys.map(date => {
              const dayRev = salesDateGroups[date].reduce((s,[_,p])=>s+(p.amount||p.paidAmt||0),0);
              const isToday = date===TODAY;
              const label = date.slice(5).replace('-','.') + (isToday?' (오늘)':'');
              return (
                <div key={date} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:isToday?P:G5}}>{label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:isToday?P:G7}}>{dayRev.toLocaleString()}원</span>
                  </div>
                  {salesDateGroups[date].map(([bkId,p]) => {
                    const b = BKS.find(x=>String(x.id)===String(bkId)||String(x.firestoreId)===String(bkId));
                    const name = b?.name||"고객";
                    const isPrepaid = p.method&&p.method.includes('선불권');
                    const custPhone = (CUSTS.find(c=>c.name===name)?.phone||'').replace(/-/g,'');
                    const prepaidRec = isPrepaid ? PREPAID_DATA.find(d=>d.custName===name) : null;
                    const bal = prepaidRec ? prepaidRec.balance : 0;
                    const dateStr = date.slice(5).replace('-','.');
                    const smsBody = `루미네일 (${name}님)\n${dateStr} ${b?.svc||''} ${(p.paidAmt||0).toLocaleString()}원 사용\n잔액 ${bal.toLocaleString()}원\n감사합니다. ♥`;
                    return (
                      <div key={bkId} style={{display:"flex",alignItems:"center",padding:"10px 14px",borderRadius:11,border:"1px solid "+G2,marginBottom:6,background:WH,gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:DK}}>{name}</div>
                          <div style={{fontSize:11,color:G5}}>{b?.svc||""} · {p.method}</div>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:P}}>{(p.amount||p.paidAmt||0).toLocaleString()}원</span>
                        {isPrepaid && custPhone && (
                          <button onClick={()=>setSmsEdit({phone:custPhone,body:smsBody})}
                            style={{padding:"5px 10px",borderRadius:8,background:PL,border:"1px solid "+PM,color:P,fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                            문자
                          </button>
                        )}
                        {onDeletePaid && (
                          <button onClick={()=>{if(window.confirm("이 결제 내역을 삭제할까요?"))onDeletePaid(bkId);}}
                            style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 2px",lineHeight:1,flexShrink:0}}>×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
      {showSales === "month" && (() => {
        const monthEntries = Object.entries(paidBks).filter(([_,p])=>p.date&&p.date.slice(0,7)===TODAY.slice(0,7));
        const totalAmt = monthEntries.reduce((s,[_,p])=>s+(p.amount||p.paidAmt||0),0);
        const methodMap = {};
        monthEntries.forEach(([_,p])=>{
          const m = p.method&&p.method.includes("선불권 충전")?"선불권 충전":p.method||"기타";
          if(!methodMap[m]) methodMap[m]={r:0,c:0,list:[]};
          methodMap[m].r+=(p.amount||p.paidAmt||0); methodMap[m].c+=1; methodMap[m].list.push([_,p]);
        });
        const byMethod = Object.entries(methodMap).sort((a,b)=>b[1].r-a[1].r);
        const COLORS=[P,OR,GR,"#FF9500","#5856D6","#FF6B6B"];
        const r=50,cx=65,cy=65,circ=2*Math.PI*r;
        let cumAngle=-90;
        return (
          <Sheet onClose={() => setShowSales(null)} maxH="85vh">
            <SheetHandle title="이번달 매출 상세" onClose={() => setShowSales(null)}/>
            <div style={{flex:1,overflowY:"auto",padding:"0 18px 40px"}}>
              <div style={{background:P,borderRadius:16,padding:"18px 20px",marginBottom:16,color:WH}}>
                <div style={{fontSize:11,opacity:0.8,marginBottom:6}}>{new Date().getMonth()+1}월 전체 · {monthEntries.length}건</div>
                <div style={{fontSize:26,fontWeight:800}}>{totalAmt.toLocaleString()}원</div>
                <div style={{marginTop:10,height:3,background:"rgba(255,255,255,0.25)",borderRadius:2}}>
                  <div style={{width:Math.min(totalAmt/8000000*100,100).toFixed(0)+"%",height:"100%",background:"rgba(255,255,255,0.7)",borderRadius:2}}/>
                </div>
                <div style={{fontSize:10,opacity:0.6,marginTop:4}}>목표 8,000,000원</div>
              </div>
              <div style={{background:WH,borderRadius:14,padding:"14px",border:"1px solid "+G2,marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:DK,marginBottom:12}}>결제수단별</div>
                {byMethod.length===0
                  ? <div style={{fontSize:12,color:G5,textAlign:"center",padding:"8px 0"}}>내역 없음</div>
                  : (
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <svg width={130} height={130} style={{flexShrink:0}}>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={G2} strokeWidth={20}/>
                        {byMethod.map(([m,v],i)=>{
                          const pct=totalAmt>0?v.r/totalAmt:0;
                          const dash=pct*circ;
                          const sa=cumAngle;
                          cumAngle+=pct*360;
                          return <circle key={m} cx={cx} cy={cy} r={r} fill="none" stroke={COLORS[i%COLORS.length]} strokeWidth={20} strokeDasharray={`${dash} ${circ-dash}`} transform={`rotate(${sa} ${cx} ${cy})`}/>;
                        })}
                        <text x={cx} y={cy-5} textAnchor="middle" style={{fontSize:13,fontWeight:"bold",fill:DK}}>{totalAmt>=10000?(totalAmt/10000).toFixed(0)+"만":totalAmt.toLocaleString()}</text>
                        <text x={cx} y={cy+11} textAnchor="middle" style={{fontSize:9,fill:G5}}>원</text>
                      </svg>
                      <div style={{flex:1}}>
                        {byMethod.map(([m,v],i)=>(
                          <div key={m} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                            <div style={{width:9,height:9,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:11,color:DK,fontWeight:600}}>{m}</div>
                              <div style={{fontSize:10,color:G5}}>{v.c}건</div>
                            </div>
                            <span style={{fontSize:11,fontWeight:700,color:COLORS[i%COLORS.length]}}>{v.r.toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
              </div>
              {byMethod.map(([method,v],i)=>(
                <div key={method} style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:COLORS[i%COLORS.length]}}/>
                    <span style={{fontSize:12,fontWeight:700,color:G5,flex:1}}>{method}</span>
                    <span style={{fontSize:12,fontWeight:700,color:DK}}>{v.r.toLocaleString()}원</span>
                  </div>
                  {v.list.sort(([_,a],[__,b])=>(b.date||'').localeCompare(a.date||'')).map(([bkId,p])=>{
                    const b=BKS.find(x=>String(x.id)===String(bkId)||String(x.firestoreId)===String(bkId));
                    const name=b?.name||"고객";
                    const dStr=(p.date||'').slice(5).replace('-','.');
                    return (
                      <div key={bkId} style={{display:"flex",alignItems:"center",padding:"9px 14px",borderRadius:11,border:"1px solid "+G2,marginBottom:5,background:WH,gap:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:DK}}>{name}</div>
                          <div style={{fontSize:11,color:G5}}>{dStr} · {b?.svc||""}</div>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:P}}>{(p.amount||p.paidAmt||0).toLocaleString()}원</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Sheet>
        );
      })()}

      {showBk && (
        <Sheet onClose={() => setShowBk(null)} maxH="75vh">
          <div style={{overflowY:"auto",flex:1,padding:"0 18px 40px"}}>
            <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"12px auto 16px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <span style={{fontSize:16,fontWeight:800,color:DK}}>예약 상세</span>
              <button onClick={() => setShowBk(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:14,background:PL,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:P,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:700,color:WH,flexShrink:0}}>{showBk.name[0]}</div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:DK}}>{showBk.name}</div>
                {(showBk.phone||(CUSTS.find(c=>c.name===showBk.name)?.phone)) && <div style={{fontSize:12,color:P,fontWeight:600,marginBottom:1}}>{showBk.phone||CUSTS.find(c=>c.name===showBk.name)?.phone}</div>}
                <div style={{fontSize:12,color:G5}}>담당자{showBk.sid+1}</div>
              </div>
            </div>
            {[
              {l:"날짜",v:showBk.date},{l:"시간",v:showBk.time+" ~ "+endTime(showBk.time,showBk.mins)},
              {l:"시술",v:showBk.svc},{l:"시술시간",v:showBk.mins+"분"},
            ].map((r,i) => (
              <div key={i} style={{display:"flex",padding:"12px 0",borderBottom:"1px solid "+G2}}>
                <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>{r.l}</span>
                <span style={{fontSize:13,fontWeight:600,color:DK}}>{r.v}</span>
              </div>
            ))}
            {/* 금액 블록 */}
            {(()=>{
              const paid=paidBks[showBk.id];
              const svcAmt=paid?paid.amount:showBk.price;
              const depA=showBk.depAmt||0;
              return (
                <div style={{margin:"8px 0 12px",borderRadius:12,border:"1px solid "+G2,overflow:"hidden"}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderBottom:"1px solid "+G2}}>
                    <span style={{fontSize:12,color:G5}}>시술 금액</span>
                    <span style={{fontSize:14,fontWeight:700,color:DK}}>{svcAmt.toLocaleString()}원</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:"1px solid "+G2,background:PS}}>
                    <div>
                      <span style={{fontSize:12,color:G5}}>예약금 </span>
                      <span style={{fontSize:12,fontWeight:600,color:showBk.dep==="unpaid"?RD:P}}>{depLabel(showBk.dep)}</span>
                    </div>
                    {depA>0
                      ?<span style={{fontSize:13,fontWeight:700,color:GR}}>−{depA.toLocaleString()}원</span>
                      :<span style={{fontSize:12,color:G5}}>{showBk.dep==="unpaid"?"미납입":"금액 미기재"}</span>
                    }
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:PL}}>
                    <span style={{fontSize:13,fontWeight:700,color:DK}}>{depA>0?"잔금 (오늘 결제)":"결제 금액"}</span>
                    <span style={{fontSize:16,fontWeight:800,color:P}}>{Math.max(0,svcAmt-depA).toLocaleString()}원</span>
                  </div>
                </div>
              );
            })()}
            {/* 결제 상태 */}
            <div style={{display:"flex",padding:"11px 0",borderBottom:"1px solid "+G2,alignItems:"center"}}>
              <span style={{fontSize:12,color:G5,width:70,flexShrink:0}}>결제상태</span>
              {paidBks[showBk.id] ? (
                <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <span style={{fontSize:13,fontWeight:700,color:OR}}>{paidBks[showBk.id].method}</span>
                    {(paidBks[showBk.id].chargeBonus||0)>0 && (
                      <div style={{fontSize:11,color:OR,marginTop:1}}>(+보너스 {(paidBks[showBk.id].chargeBonus).toLocaleString()}원)</div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={() => {if(onPay)onPay(showBk);setShowBk(null);}}
                      style={{padding:"4px 10px",borderRadius:8,background:PL,border:"1px solid "+PM,color:P,fontSize:10,fontWeight:700,cursor:"pointer"}}>수정</button>
                    <button onClick={() => {
                      if(onCancelPay) onCancelPay(showBk.id, showBk.name);
                      setShowBk(null);
                    }} style={{padding:"4px 10px",borderRadius:8,background:"#FFF0F0",border:"1px solid "+RD,color:RD,fontSize:10,fontWeight:700,cursor:"pointer"}}>취소</button>
                  </div>
                </div>
              ) : (
                <span style={{fontSize:13,fontWeight:600,color:G5}}>미결제</span>
              )}
            </div>
            {!paidBks[showBk.id] && (
              <div style={{display:"flex",gap:9,marginTop:14}}>
                <button onClick={()=>setDelConfirmBk(showBk)}
                  style={{flex:1,padding:"13px",borderRadius:14,background:WH,border:"1.5px solid "+RD,color:RD,fontSize:13,fontWeight:700,cursor:"pointer"}}>삭제</button>
                <button onClick={()=>{setEditBk({...showBk});setShowBk(null);}}
                  style={{flex:1,padding:"13px",borderRadius:14,background:WH,border:"1.5px solid "+G2,color:G7,fontSize:13,fontWeight:700,cursor:"pointer"}}>수정</button>
                <button onClick={()=>{if(onPay){onPay(showBk);setShowBk(null);}}}
                  style={{flex:1,padding:"13px",borderRadius:14,background:P,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px "+P+"44"}}>결제 처리</button>
              </div>
            )}
            {paidBks[showBk.id] && (
              <div style={{display:"flex",gap:9,marginTop:12}}>
                <button onClick={() => { setEditBk({...showBk}); setShowBk(null); }}
                  style={{flex:1,padding:"12px",borderRadius:12,background:WH,border:"1.5px solid "+G2,color:G7,fontSize:12,fontWeight:700,cursor:"pointer"}}>수정</button>
                <div style={{flex:2,padding:"12px 16px",borderRadius:12,background:"#E8F9EF",border:"1px solid "+GR,textAlign:"center",fontSize:12,fontWeight:700,color:GR}}>
                  결제완료 · {paidBks[showBk.id].method}
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}

      {smsEdit && (
        <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:430,background:WH,borderRadius:"22px 22px 0 0",padding:"22px 18px 44px"}}>
            <div style={{fontSize:14,fontWeight:700,color:DK,marginBottom:10}}>문자 내용 확인 · 수정</div>
            <textarea value={smsEdit.body} onChange={e=>setSmsEdit(v=>({...v,body:e.target.value}))}
              style={{width:"100%",minHeight:90,padding:"12px",borderRadius:11,border:"1.5px solid "+G2,fontSize:13,color:DK,background:BG,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.7,fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>setSmsEdit(null)} style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:13,fontWeight:600,cursor:"pointer"}}>취소</button>
              <a href={`sms:${smsEdit.phone}&body=${encodeURIComponent(smsEdit.body)}`}
                onClick={()=>setTimeout(()=>setSmsEdit(null),300)}
                style={{flex:2,padding:"13px",borderRadius:13,background:P,color:WH,fontSize:13,fontWeight:700,textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WH} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                문자 보내기
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 예약 수정 팝업 (홈) */}
      {editBk && (
        <EditBookingSheet
          editBk={editBk} setEditBk={setEditBk} staff={staff}
          slotUnit={slotUnit}
          onSave={() => {
            const idx = BKS.findIndex(b => b.id===editBk.id);
            if(idx>=0) BKS[idx] = {...BKS[idx], ...editBk};
            if(onUpdate) onUpdate(editBk, editBk);
            setEditBk(null);
          }}
          onClose={() => setEditBk(null)}
        />
      )}
      {delConfirmBk && (
        <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setDelConfirmBk(null)}>
          <div style={{background:WH,borderRadius:"20px 20px 0 0",padding:"28px 20px 44px",width:"100%",maxWidth:430,boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,color:DK,marginBottom:8,textAlign:"center"}}>예약 삭제</div>
            <div style={{fontSize:13,color:G5,marginBottom:28,textAlign:"center",lineHeight:1.6}}>삭제된 예약은 복구할 수 없습니다.<br/>예약을 삭제하시겠습니까?</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDelConfirmBk(null)} style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:14,fontWeight:700,cursor:"pointer"}}>취소</button>
              <button onClick={()=>{if(onDelete)onDelete(delConfirmBk);setShowBk(null);setDelConfirmBk(null);}} style={{flex:1,padding:"13px",borderRadius:13,background:"#FF4D4D",border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer"}}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
let PREPAID_DATA = [];
function daysLeft(expiry) {
  if(!expiry) return null;
  return Math.ceil((new Date(expiry) - new Date(TODAY)) / (1000*60*60*24));
}
function buildPrepaidFromPaidBks(paidBks) {
  const map = {};
  const entries = Object.entries(paidBks).sort((a,b)=>(a[1].date||'').localeCompare(b[1].date||''));
  entries.forEach(([bkId, p]) => {
    if(!p.method) return;
    const custName = p.custName || BKS.find(b=>String(b.id)===String(bkId))?.name;
    if(!custName) return;
    if(!map[custName]) map[custName]={custId:Number(bkId),custName,balance:0,total:0,history:[]};
    const rec=map[custName];
    if(p.method.includes("선불권 충전")) {
      const charge = p.chargeAmt || (() => { const m=p.method.match(/선불권 충전 ([\d,]+)원/); return m?Number(m[1].replace(/,/g,'')):0; })();
      const cb = p.chargeBonus||0;
      const total=charge+cb, deduct=p.paidAmt||0;
      rec.total+=total; rec.balance+=total-deduct;
      if(total>0) rec.history.push({id:Date.now()+Math.random(),type:"charge",amount:total,date:p.date,memo:charge.toLocaleString()+"원 충전"+(cb>0?" (+보너스 "+cb.toLocaleString()+"원)":"")});
      if(deduct>0) rec.history.push({id:Date.now()+Math.random(),type:"use",amount:deduct,date:p.date,memo:"결제"});
    } else if(p.method==="선불권 사용") {
      const deduct=p.paidAmt||0;
      rec.balance-=deduct;
      rec.history.push({id:Date.now()+Math.random(),type:"use",amount:deduct,date:p.date,memo:"결제"});
    }
  });
  return Object.values(map).filter(r=>r.total>0||r.history.length>0);
}

function PrepaidPage({ onBack, bonusRates, onUpdateBonus, prepaidData, onPrepaidUpdate }) {
  const data = prepaidData || [];
  const [activeTab, setActiveTab] = useState("prepaid");
  const [sel, setSel] = useState(null);
  const [smsEdit, setSmsEdit] = useState(null);
  const [showCharge, setShowCharge] = useState(false);
  const [showUse, setShowUse] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [chargeMethod, setChargeMethod] = useState("");
  const [bonusInput, setBonusInput] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [newBonus, setNewBonus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  // 보유고객 박스 검색 상태
  const [showCustSearch, setShowCustSearch] = useState(false);
  const [custSearchQ, setCustSearchQ] = useState("");
  const [showBonusSetting, setShowBonusSetting] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [newExpiry, setNewExpiry] = useState("");

  const filteredData = data.filter(d => d.custName.includes(searchQ));
  const filteredCusts = CUSTS.filter(c =>
    c.name.includes(custSearchQ) || c.phone.replace(/-/g,"").includes(custSearchQ.replace(/-/g,""))
  );

  function charge() {
    if(!amount) return;
    const amt=Number(amount);
    const bonus=Number(bonusInput)||0;
    const total=amt+bonus;
    const updated={...sel,balance:sel.balance+total,total:sel.total+total,
      ...(expiry?{expiry}:{}),
      history:[...sel.history,{id:Date.now(),type:"charge",amount:total,date:TODAY,
        memo:(memo||"충전")+(bonus>0?" (충전 "+amt.toLocaleString()+"원 + 보너스 "+bonus.toLocaleString()+"원)":"")}]};
    const nd=data.map(d=>d.custId===sel.custId?updated:d);
    onPrepaidUpdate(nd); setSel(updated);
    setAmount(""); setMemo(""); setChargeMethod(""); setBonusInput(""); setExpiry(""); setShowCharge(false);
  }
  function use() {
    if(!amount||Number(amount)>sel.balance) return;
    const amt=Number(amount);
    const updated={...sel,balance:sel.balance-amt,
      history:[...sel.history,{id:Date.now(),type:"use",amount:amt,date:TODAY,memo:memo||"사용"}]};
    const nd=data.map(d=>d.custId===sel.custId?updated:d);
    onPrepaidUpdate(nd); setSel(updated);
    setAmount(""); setMemo(""); setShowUse(false);
  }
  function deleteHistory(h) {
    const balDelta = h.type==="charge" ? -h.amount : h.amount;
    const totDelta = h.type==="charge" ? -h.amount : 0;
    const updated = {...sel,
      balance: Math.max(0,(sel.balance||0)+balDelta),
      total: Math.max(0,(sel.total||0)+totDelta),
      history: sel.history.filter(x=>x.id!==h.id)
    };
    const nd = data.map(d=>d.custId===sel.custId?updated:d)
      .filter(d=>d.total>0||d.history.length>0);
    onPrepaidUpdate(nd);
    setSel(updated.history.length>0||updated.total>0 ? updated : null);
  }
  function deleteRecord() {
    if(!window.confirm(sel.custName+"님의 선불권 전체를 삭제할까요?")) return;
    onPrepaidUpdate(data.filter(d=>d.custId!==sel.custId));
    setSel(null);
  }
  function addNew() {
    if(!newCust.trim()||!newAmt) return;
    const amt = Number(newAmt);
    const bonus = Number(newBonus)||0;
    const total = amt + bonus;
    const n={custId:Date.now(),custName:newCust.trim(),balance:total,total:total,
      ...(newExpiry?{expiry:newExpiry}:{}),
      history:[{id:1,type:"charge",amount:total,date:TODAY,
        memo:"신규 발급"+(bonus>0?" (충전 "+amt.toLocaleString()+"원 + 보너스 "+bonus.toLocaleString()+"원)":"")}]};
    const nd=[...data,n];
    onPrepaidUpdate(nd);
    setNewCust(""); setNewAmt(""); setNewMethod(""); setNewBonus(""); setNewExpiry(""); setShowNew(false);
  }

  if(sel) return (
    <div style={{minHeight:"100vh",background:BG,paddingBottom:40}}>
      <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <button onClick={() => setSel(null)} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>‹ 목록</button>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>선불권 상세</span>
        <button onClick={deleteRecord} style={{background:"none",border:"none",cursor:"pointer",color:RD,fontSize:12,fontWeight:600,padding:"4px 6px"}}>전체삭제</button>
      </div>
      <div style={{padding:"14px 16px"}}>
        <div style={{background:P,borderRadius:20,padding:"22px 20px",marginBottom:14,boxShadow:"0 6px 20px "+P+"40"}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:6}}>{sel.custName}님 선불권 잔액</div>
          <div style={{fontSize:30,fontWeight:800,color:WH,marginBottom:8}}>{sel.balance.toLocaleString()}원</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>총 충전액 {sel.total.toLocaleString()}원</div>
            {sel.expiry && (()=>{
              const dl=daysLeft(sel.expiry);
              const label=dl<=0?"만료":dl<=7?"D-"+dl+" ⚠":"D-"+dl;
              const clr=dl<=0?"#FF6B6B":dl<=7?"#FFD93D":"rgba(255,255,255,0.8)";
              return <div style={{fontSize:11,fontWeight:700,color:clr}}>{sel.expiry} ({label})</div>;
            })()}
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <button onClick={() => setShowCharge(true)} style={{flex:1,padding:"13px",borderRadius:14,background:P,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 충전</button>
          <button onClick={() => setShowUse(true)} style={{flex:1,padding:"13px",borderRadius:14,background:WH,border:"1.5px solid "+P,color:P,fontSize:13,fontWeight:700,cursor:"pointer"}}>사용 처리</button>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:DK,marginBottom:10}}>사용 이력</div>
        {[...sel.history].reverse().map(h => (
          <div key={h.id} style={{background:WH,borderRadius:13,padding:"12px 15px",marginBottom:8,border:"1px solid "+G2,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:h.type==="charge"?GRL:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,marginRight:4,flexShrink:0}}>
              {h.type==="charge"?"+":"-"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:DK}}>{h.memo}</div>
              <div style={{fontSize:11,color:G5}}>{h.date}</div>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:h.type==="charge"?GR:RD}}>
              {h.type==="charge"?"+":"-"}{h.amount.toLocaleString()}원
            </span>
            <button onClick={() => { if(window.confirm("이 내역을 삭제할까요?")) deleteHistory(h); }}
              style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:16,padding:"0 2px",lineHeight:1,flexShrink:0}}>×</button>
          </div>
        ))}
      </div>
      {showCharge && (
        <Sheet onClose={() => {setShowCharge(false);setAmount("");setMemo("");setChargeMethod("");setBonusInput("");}} maxH="85vh">
          <SheetHandle title="선불권 충전" onClose={() => {setShowCharge(false);setAmount("");setMemo("");setChargeMethod("");setBonusInput("");}}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 18px 40px"}}>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:6}}>유효기간 <span style={{fontWeight:400,color:G5}}>(선택)</span></div>
              <input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+(expiry?P:G2),fontSize:13,outline:"none",color:expiry?DK:G5,background:WH,boxSizing:"border-box"}}/>
            </div>
            <PrepaidChargeForm
              amount={amount} setAmount={setAmount}
              chargeMethod={chargeMethod} setChargeMethod={setChargeMethod}
              bonusInput={bonusInput} setBonusInput={setBonusInput}
              memo={memo} setMemo={setMemo}
              onConfirm={charge}
              confirmLabel={amount ? Number(amount).toLocaleString()+"원 충전" : "금액을 입력하세요"}
              confirmActive={!!amount}
            />
          </div>
        </Sheet>
      )}
      {showUse && (
        <Sheet onClose={() => setShowUse(false)} maxH="60vh">
          <SheetHandle title="사용 처리" onClose={() => setShowUse(false)}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 18px 40px"}}>
            <div style={{fontSize:12,color:G5,marginBottom:12}}>잔액: {sel.balance.toLocaleString()}원</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:G5,marginBottom:6}}>사용 금액</div>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0"
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+G2,fontSize:15,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:G5,marginBottom:6}}>시술명</div>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 젤네일 아트"
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
            <button onClick={use}
              style={{width:"100%",padding:"14px",borderRadius:14,background:Number(amount)>sel.balance?G3:P,border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {Number(amount)>sel.balance?"잔액 부족":"사용 처리"}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:BG,paddingBottom:40}}>
      <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>‹ 뒤로</button>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>회원권 관리</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={() => setShowBonusSetting(true)} title="적립 설정"
            style={{background:"none",border:"none",cursor:"pointer",padding:"4px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={G5} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>

      </div>

      {/* 탭 */}
      <div style={{display:"flex",background:WH,borderBottom:"1px solid "+G2,position:"sticky",top:50,zIndex:49}}>
        {[{k:"prepaid",l:"선불권"},{k:"session",l:"횟수권"}].map(({k,l})=>(
          <button key={k} onClick={()=>{setActiveTab(k);setSel(null);}}
            style={{flex:1,padding:"12px 0",background:"none",border:"none",borderBottom:activeTab===k?"2.5px solid "+P:"2.5px solid transparent",color:activeTab===k?P:G5,fontSize:13,fontWeight:activeTab===k?800:500,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      {activeTab==="session" ? (
        <div style={{padding:"40px 20px",textAlign:"center",color:G5}}>
          <div style={{fontSize:40,marginBottom:16}}>🎟</div>
          <div style={{fontSize:15,fontWeight:700,color:DK,marginBottom:8}}>횟수권 관리</div>
          <div style={{fontSize:13,lineHeight:1.8}}>횟수권 기능은 준비 중입니다.</div>
        </div>
      ) : (
      <div style={{padding:"14px 16px 8px"}}>
        {/* 요약 카드 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div style={{background:P,borderRadius:16,padding:"14px",boxShadow:"0 4px 14px "+P+"40"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",marginBottom:4}}>총 잔액 합계</div>
            <div style={{fontSize:18,fontWeight:800,color:WH}}>{data.reduce((s,d)=>s+d.balance,0).toLocaleString()}원</div>
          </div>
          <div style={{background:WH,borderRadius:16,padding:"14px",border:"1px solid "+G2}}>
            <div style={{fontSize:10,color:G5,marginBottom:4}}>보유 고객</div>
            <div style={{fontSize:18,fontWeight:800,color:DK}}>{data.length}명</div>
            <div style={{fontSize:10,color:G5,marginTop:4}}>총충전 {data.reduce((s,d)=>s+d.total,0).toLocaleString()}원</div>
          </div>
        </div>
        {/* 오늘 선불권 사용 고객 */}
        {(()=>{
          const todayUses = data.flatMap(d =>
            d.history.filter(h=>h.type==='use'&&h.date===TODAY).map(h=>({
              custName:d.custName,
              custPhone:(CUSTS.find(c=>c.name===d.custName)?.phone||'').replace(/-/g,''),
              balance:d.balance,
              svc:h.memo.replace(/ 결제$/,''),
              amount:h.amount,
              dateStr:TODAY.slice(5).replace('-','.'),
            }))
          );
          if(!todayUses.length) return null;
          return (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:DK,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                오늘 선불권 사용 · {todayUses.length}명
              </div>
              {todayUses.map((u,i)=>{
                const body=`루미네일 (${u.custName}님)\n${u.dateStr} ${u.svc} ${u.amount.toLocaleString()}원 사용\n잔액 ${u.balance.toLocaleString()}원\n감사합니다. ♥`;
                return (
                  <div key={i} style={{background:WH,borderRadius:13,padding:"11px 14px",marginBottom:7,border:"1px solid "+G2,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:DK}}>{u.custName}님</div>
                      <div style={{fontSize:11,color:G5,marginTop:2}}>{u.svc} {u.amount.toLocaleString()}원 · 잔액 <span style={{color:P,fontWeight:600}}>{u.balance.toLocaleString()}원</span></div>
                    </div>
                    {u.custPhone ? (
                      <button onClick={()=>setSmsEdit({phone:u.custPhone,body})}
                        style={{padding:"7px 13px",borderRadius:10,background:PL,border:"1px solid "+PM,color:P,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        문자
                      </button>
                    ) : <span style={{fontSize:10,color:G5}}>번호없음</span>}
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* 만료 임박 */}
        {(()=>{
          const expiring=data.filter(d=>{const dl=daysLeft(d.expiry);return dl!==null&&dl<=30;}).sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));
          if(!expiring.length) return null;
          return (
            <div style={{marginBottom:14,background:"#FFF8E7",borderRadius:14,padding:"12px 14px",border:"1px solid #FFD93D"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#B8860B",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                만료 임박 {expiring.length}명
              </div>
              {expiring.map(d=>{
                const dl=daysLeft(d.expiry);
                return (
                  <div key={d.custId} onClick={()=>setSel(d)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderTop:"1px solid #FFE88A",cursor:"pointer"}}>
                    <div style={{fontSize:13,fontWeight:600,color:DK}}>{d.custName} <span style={{fontSize:11,color:G5,fontWeight:400}}>잔액 {d.balance.toLocaleString()}원</span></div>
                    <span style={{fontSize:11,fontWeight:700,color:dl<=7?RD:"#B8860B",background:dl<=7?"#FFE0E0":"#FFF3CD",borderRadius:6,padding:"2px 8px"}}>{dl<=0?"만료":dl<=7?"D-"+dl+" ⚠":"D-"+dl}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* 검색창 */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{flex:1,display:"flex",alignItems:"center",background:WH,borderRadius:11,border:"1px solid "+G2,padding:"9px 12px",gap:8}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G5} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="고객 이름 검색"
            style={{flex:1,border:"none",outline:"none",fontSize:13,color:DK,background:"transparent"}}/>
          {searchQ&&<button onClick={() => setSearchQ("")} style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:16}}>×</button>}
          </div>
          <button onClick={() => setShowNew(true)} style={{padding:"8px 12px",borderRadius:11,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>+ 신규</button>
        </div>
        {filteredData.map(d => {
          const custPhone = CUSTS.find(c=>c.name===d.custName)?.phone||'';
          const lastUse = [...d.history].filter(h=>h.type==='use').sort((a,b)=>b.date.localeCompare(a.date))[0];
          const dateStr = lastUse ? lastUse.date.slice(5).replace('-','.') : TODAY.slice(5).replace('-','.');
          const svcStr = lastUse ? lastUse.memo.replace(/ 결제$/,'') : '';
          const amtStr = lastUse ? lastUse.amount.toLocaleString() : '';
          const smsBody = encodeURIComponent(`루미네일 (${d.custName}님) ${dateStr} ${svcStr} ${amtStr}원 사용  잔액 ${d.balance.toLocaleString()}원`);
          return (
          <div key={d.custId}
            style={{background:WH,borderRadius:16,padding:"14px 16px",marginBottom:10,border:"1px solid "+G2,display:"flex",alignItems:"center",gap:12}}>
            <div onClick={() => setSel(d)} style={{display:"flex",alignItems:"center",gap:12,flex:1,cursor:"pointer"}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:P,flexShrink:0}}>{d.custName[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:DK,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                {d.custName}
                {d.expiry&&(()=>{
                  const dl=daysLeft(d.expiry);
                  if(dl===null) return null;
                  const bg=dl<=0?"#FFE0E0":dl<=7?"#FFF3CD":"#F0F7FF";
                  const cl=dl<=0?RD:dl<=7?"#B8860B":"#4A90D9";
                  return <span style={{fontSize:10,fontWeight:700,color:cl,background:bg,borderRadius:5,padding:"2px 6px"}}>{dl<=0?"만료":"D-"+dl}</span>;
                })()}
              </div>
              <div style={{height:4,background:G2,borderRadius:2,marginBottom:4}}>
                <div style={{width:d.total>0?Math.min(d.balance/d.total*100,100).toFixed(0)+"%":"0%",height:"100%",background:P,borderRadius:2}}/>
              </div>
              <div style={{fontSize:11,color:G5}}>잔액 {d.balance.toLocaleString()}원 / 총 {d.total.toLocaleString()}원</div>
            </div>
            </div>
            {custPhone && (
              <button onClick={e=>{e.stopPropagation();setSmsEdit({phone:custPhone.replace(/-/g,''),body:smsBody});}}
                style={{width:36,height:36,borderRadius:"50%",background:PL,border:"1px solid "+PM,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
            )}
            <span onClick={() => setSel(d)} style={{fontSize:15,fontWeight:800,color:P,cursor:"pointer"}}>›</span>
          </div>
          );
        })}
      </div>
      )} {/* end activeTab===prepaid */}

      {/* 신규 발급 */}
      {showNew && (
        <Sheet onClose={() => {setShowNew(false);setNewCust("");setNewAmt("");setNewMethod("");setNewBonus("");}} maxH="88vh">
          <SheetHandle title="선불권 신규 발급" onClose={() => {setShowNew(false);setNewCust("");setNewAmt("");setNewMethod("");setNewBonus("");}}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 18px 44px"}}>
            {/* 고객명 */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:6}}>고객명</div>
              <input value={newCust} onChange={e => setNewCust(e.target.value)} placeholder="고객 이름"
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+(newCust?P:G2),fontSize:14,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>
            {/* 유효기간 */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:6}}>유효기간 <span style={{fontWeight:400,color:G5}}>(선택)</span></div>
              <input type="date" value={newExpiry} onChange={e=>setNewExpiry(e.target.value)}
                style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+(newExpiry?P:G2),fontSize:13,outline:"none",color:newExpiry?DK:G5,background:WH,boxSizing:"border-box"}}/>
            </div>
            {/* 공통 충전 폼 */}
            <PrepaidChargeForm
              amount={newAmt} setAmount={setNewAmt}
              chargeMethod={newMethod} setChargeMethod={setNewMethod}
              bonusInput={newBonus} setBonusInput={setNewBonus}
              memo={""} setMemo={()=>{}}
              onConfirm={addNew}
              confirmLabel={newCust && newAmt
                ? newCust+"님 "+((Number(newAmt)+(Number(newBonus)||0)).toLocaleString())+"원 발급"
                : "고객명과 금액을 입력하세요"}
              confirmActive={!!(newCust && newAmt)}
            />
          </div>
        </Sheet>
      )}

      {/* 적립 설정 팝업 */}
      {showBonusSetting && bonusRates && (
        <Sheet onClose={() => setShowBonusSetting(false)} maxH="60vh">
          <SheetHandle title="선불권 적립 설정" onClose={() => setShowBonusSetting(false)}/>
          <div style={{flex:1,overflowY:"auto",padding:"0 18px 40px"}}>
            <div style={{fontSize:12,color:G5,marginBottom:14,lineHeight:1.6}}>
              결제수단별 보너스 적립 비율을 설정하세요.<br/>
              예: 카드 10% → 20만원 결제 시 2만원 추가 적립
            </div>
            {[
              {v:"naverpay",l:"N페이"},
              {v:"card",    l:"카드"},
              {v:"cash",    l:"현금"},
            ].map(m => (
              <div key={m.v} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid "+G2}}>
                <span style={{fontSize:14,fontWeight:600,color:DK}}>{m.l}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={() => onUpdateBonus&&onUpdateBonus({...bonusRates,[m.v]:Math.max(0,(bonusRates[m.v]||0)-5)})}
                    style={{width:32,height:32,borderRadius:"50%",background:G2,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,color:G7,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <span style={{fontSize:18,fontWeight:800,color:P,minWidth:40,textAlign:"center"}}>{bonusRates[m.v]||0}%</span>
                  <button onClick={() => onUpdateBonus&&onUpdateBonus({...bonusRates,[m.v]:Math.min(50,(bonusRates[m.v]||0)+5)})}
                    style={{width:32,height:32,borderRadius:"50%",background:PL,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,color:P,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
              </div>
            ))}
            <div style={{marginTop:14,padding:"10px 13px",borderRadius:10,background:PS,fontSize:11,color:G5}}>
              적립된 보너스는 선불권 잔액에 자동 반영됩니다
            </div>
          </div>
        </Sheet>
      )}
      {smsEdit && (
        <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:430,background:WH,borderRadius:"22px 22px 0 0",padding:"22px 18px 44px"}}>
            <div style={{fontSize:14,fontWeight:700,color:DK,marginBottom:10}}>문자 내용 확인 · 수정</div>
            <textarea value={smsEdit.body} onChange={e=>setSmsEdit(v=>({...v,body:e.target.value}))}
              style={{width:"100%",minHeight:90,padding:"12px",borderRadius:11,border:"1.5px solid "+G2,fontSize:13,color:DK,background:BG,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.7,fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>setSmsEdit(null)} style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:13,fontWeight:600,cursor:"pointer"}}>취소</button>
              <a href={`sms:${smsEdit.phone}&body=${encodeURIComponent(smsEdit.body)}`}
                onClick={()=>setTimeout(()=>setSmsEdit(null),300)}
                style={{flex:2,padding:"13px",borderRadius:13,background:P,color:WH,fontSize:13,fontWeight:700,textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WH} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                문자 보내기
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 설정 ─────────────────────────────────────────────
const INIT_SVCS = [
  {id:"nail",label:"네일",items:[{id:1,name:"젤네일 단색",mins:60,price:40000},{id:2,name:"젤네일 아트",mins:90,price:65000},{id:3,name:"이달의아트",mins:90,price:70000},{id:4,name:"제거+기본젤",mins:60,price:40000}]},
  {id:"pedi",label:"패디",items:[{id:5,name:"패디큐어",mins:60,price:45000},{id:6,name:"발아트",mins:90,price:60000}]},
  {id:"eye",label:"속눈썹",items:[{id:7,name:"속눈썹 연장",mins:90,price:80000},{id:8,name:"속눈썹 리터치",mins:60,price:50000}]},
  {id:"wax",label:"왁싱",items:[{id:9,name:"다리왁싱",mins:60,price:60000},{id:10,name:"브라질리언",mins:60,price:70000}]},
];

function ServiceMenuPage({ onBack, uid }) {
  const svcKey = `svcMenu_${uid||"local"}`;
  const [saved, setSaved] = useState(false);
  const [cats, setCats] = useState(() => { try { const s=localStorage.getItem(svcKey); return s?JSON.parse(s):SVCS; } catch { return SVCS; } });
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({name:"",mins:60,price:0});
  const [showAdd, setShowAdd] = useState(null);
  const [newItem, setNewItem] = useState({name:"",mins:60,price:0});
  const [newCatN, setNewCatN] = useState("");
  const [showCat, setShowCat] = useState(false);
  const timeOpts = [30,60,90,120,150,180];

  function startEdit(catId,item) { setEditId(catId+"-"+item.id); setEditF({name:item.name,mins:item.mins,price:item.price}); }
  function saveEdit(catId,itemId) { setCats(p=>p.map(c=>c.id!==catId?c:{...c,items:c.items.map(i=>i.id===itemId?{...i,...editF}:i)})); setEditId(null); }
  function delItem(catId,itemId) { setCats(p=>p.map(c=>c.id!==catId?c:{...c,items:c.items.filter(i=>i.id!==itemId)})); setEditId(null); }
  function addItem(catId) {
    if(!newItem.name.trim()) return;
    setCats(p=>p.map(c=>c.id!==catId?c:{...c,items:[...c.items,{id:Date.now(),...newItem}]}));
    setNewItem({name:"",mins:60,price:0}); setShowAdd(null);
  }
  function addCat() { if(!newCatN.trim()) return; setCats(p=>[...p,{id:"cat"+Date.now(),label:newCatN.trim(),items:[]}]); setNewCatN(""); setShowCat(false); }
  function saveMenu(latestCats) { try { localStorage.setItem(svcKey, JSON.stringify(latestCats)); } catch {} SVCS=latestCats; setSaved(true); setTimeout(()=>setSaved(false),2000); }

  return (
    <div style={{minHeight:"100vh",background:BG,paddingBottom:40}}>
      <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>‹ 뒤로</button>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>시술메뉴 관리</span>
        <button onClick={()=>saveMenu(cats)} style={{background:saved?"none":P,border:"none",color:saved?G5:WH,fontSize:13,fontWeight:700,cursor:"pointer",padding:"7px 16px",borderRadius:10}}>{saved?"저장완료":"저장"}</button>
      </div>
      {cats.map(cat => (
        <div key={cat.id} style={{marginBottom:8}}>
          <div style={{padding:"8px 18px",background:G2}}>
            <span style={{fontSize:11,fontWeight:700,color:G5,letterSpacing:0.5}}>{cat.label}</span>
          </div>
          <div style={{background:WH}}>
            {cat.items.map(item => {
              const isEd=editId===cat.id+"-"+item.id;
              if(isEd) return (
                <div key={item.id} style={{padding:"13px 18px",borderBottom:"1px solid "+G2,background:PS}}>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:10,color:G5,marginBottom:4}}>이름</div>
                    <input value={editF.name} onChange={e => setEditF(f=>({...f,name:e.target.value}))}
                      style={{width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid "+P,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                  </div>
                  <div style={{display:"flex",gap:9,marginBottom:11}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:G5,marginBottom:4}}>시간</div>
                      <select value={editF.mins} onChange={e => setEditF(f=>({...f,mins:Number(e.target.value)}))}
                        style={{width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH}}>
                        {timeOpts.map(m=><option key={m} value={m}>{m}분</option>)}
                      </select>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:G5,marginBottom:4}}>가격</div>
                      <input value={editF.price} onChange={e => setEditF(f=>({...f,price:Number(e.target.value)}))} type="number"
                        style={{width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={() => delItem(cat.id,item.id)} style={{flex:1,padding:"9px",borderRadius:10,background:"#FFF0F0",border:"1px solid "+RD,color:RD,fontSize:12,fontWeight:600,cursor:"pointer"}}>삭제</button>
                    <button onClick={() => setEditId(null)} style={{flex:1,padding:"9px",borderRadius:10,background:G2,border:"none",color:G7,fontSize:12,cursor:"pointer"}}>취소</button>
                    <button onClick={() => saveEdit(cat.id,item.id)} style={{flex:2,padding:"9px",borderRadius:10,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer"}}>저장</button>
                  </div>
                </div>
              );
              return (
                <div key={item.id} onClick={() => startEdit(cat.id,item)}
                  style={{display:"flex",alignItems:"center",padding:"13px 18px",borderBottom:"1px solid "+G2,cursor:"pointer"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:DK}}>{item.name}</div>
                    <div style={{fontSize:11,color:G5,marginTop:2}}>{item.price.toLocaleString()}원 · {item.mins}분</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:PM,background:PL,padding:"3px 8px",borderRadius:6}}>편집</span>
                </div>
              );
            })}
            {showAdd===cat.id ? (
              <div style={{padding:"13px 18px",background:PS}}>
                <input value={newItem.name} onChange={e => setNewItem(f=>({...f,name:e.target.value}))} placeholder="시술명"
                  style={{width:"100%",padding:"9px 11px",borderRadius:10,border:"1.5px solid "+P,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box",marginBottom:8}}/>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <select value={newItem.mins} onChange={e => setNewItem(f=>({...f,mins:Number(e.target.value)}))}
                    style={{flex:1,padding:"8px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH}}>
                    {timeOpts.map(m=><option key={m} value={m}>{m}분</option>)}
                  </select>
                  <input value={newItem.price} onChange={e => setNewItem(f=>({...f,price:Number(e.target.value)}))} type="number" placeholder="가격"
                    style={{flex:1,padding:"8px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH}}/>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={() => setShowAdd(null)} style={{flex:1,padding:"9px",borderRadius:10,background:G2,border:"none",color:G7,fontSize:12,cursor:"pointer"}}>취소</button>
                  <button onClick={() => addItem(cat.id)} style={{flex:2,padding:"9px",borderRadius:10,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer"}}>추가</button>
                </div>
              </div>
            ) : (
              <button onClick={() => {setShowAdd(cat.id);setNewItem({name:"",mins:60,price:0});}}
                style={{width:"100%",padding:"12px 18px",background:"none",border:"none",textAlign:"left",cursor:"pointer",color:PM,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>+ {cat.label} 시술 추가</button>
            )}
          </div>
        </div>
      ))}
      <div style={{padding:"14px 18px"}}>
        {showCat ? (
          <div style={{display:"flex",gap:7}}>
            <input value={newCatN} onChange={e => setNewCatN(e.target.value)} placeholder="카테고리명"
              style={{flex:1,padding:"10px 12px",borderRadius:11,border:"1.5px solid "+P,fontSize:12,outline:"none",color:DK,background:WH}}/>
            <button onClick={addCat} style={{padding:"10px 14px",borderRadius:11,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer"}}>추가</button>
            <button onClick={() => setShowCat(false)} style={{padding:"10px 12px",borderRadius:11,background:G2,border:"none",fontSize:11,cursor:"pointer"}}>취소</button>
          </div>
        ) : (
          <button onClick={() => setShowCat(true)}
            style={{width:"100%",padding:"12px",borderRadius:13,border:"1.5px dashed "+PM,background:WH,color:PM,fontSize:12,fontWeight:600,cursor:"pointer"}}>+ 새 카테고리 추가</button>
        )}
      </div>
    </div>
  );
}

// ── 샵 이름 설정 컴포넌트 ─────────────────────────────
function ShopNameSetting({ shopName, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(shopName);

  function save() {
    if(val.trim()) onUpdate(val.trim());
    setEditing(false);
  }

  return (
    <div style={{background:WH,borderBottom:"1px solid "+G2,padding:"14px 18px"}}>
      <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:8,letterSpacing:0.3}}>샵 이름</div>
      {editing ? (
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if(e.key==="Enter") save(); if(e.key==="Escape") setEditing(false); }}
            autoFocus
            style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1.5px solid "+P,fontSize:15,fontWeight:700,outline:"none",color:P,fontFamily:"Georgia,serif",background:WH,boxSizing:"border-box"}}
          />
          <button onClick={save}
            style={{padding:"9px 16px",borderRadius:10,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer"}}>저장</button>
          <button onClick={() => { setVal(shopName); setEditing(false); }}
            style={{padding:"9px 12px",borderRadius:10,background:G2,border:"none",color:G7,fontSize:12,cursor:"pointer"}}>취소</button>
        </div>
      ) : (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:P}}>{shopName}</span>
          <button onClick={() => { setVal(shopName); setEditing(true); }}
            style={{padding:"5px 14px",borderRadius:9,background:PL,border:"none",color:P,fontSize:11,fontWeight:600,cursor:"pointer"}}>변경</button>
        </div>
      )}
    </div>
  );
}

function SettingsPage({ staff, onUpdateStaff, initialSub, onClearSub, bonusRates, onUpdateBonus, slotUnit, onUpdateSlotUnit, shopName, onUpdateShopName, onImportCustomers, onImportBookings, uid, onChangePassword, email, naverUrl="", onUpdateNaverUrl }) {
  const [sub, setSub] = useState(initialSub||null);
  const [sl, setSl] = useState(staff);
  const [newN, setNewN] = useState("");
  const [editId, setEditId] = useState(null);
  const [editN, setEditN] = useState("");
  const [naverImportText, setNaverImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [naverUrlEdit, setNaverUrlEdit] = useState(false);
  const [naverUrlInput, setNaverUrlInput] = useState(naverUrl);
  const [showBkImport, setShowBkImport] = useState(false);
  const [naverBkText, setNaverBkText] = useState("");
  const [bkImporting, setBkImporting] = useState(false);
  const [bkImportResult, setBkImportResult] = useState(null);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [bkImportSid, setBkImportSid] = useState(() => staff[0]?.id ?? 0);

  function parseNaverText(txt) {
    const STATUS = new Set(["완료","취소","확정","대기","노쇼","상태","예약자","전화번호"]);
    const lines = txt.split(/\n/).map(l=>l.split(/\t/)[0].trim()).filter(Boolean);
    const result = new Map();
    for(let i=0; i<lines.length; i++) {
      const phoneM = lines[i].match(/^(010-\d{4}-\d{4})/);
      if(phoneM) {
        const phone = phoneM[1];
        for(let j=i-1; j>=Math.max(0,i-4); j--) {
          const cand = lines[j];
          if(!STATUS.has(cand) && !/^\d/.test(cand) && cand.length>=2 && cand.length<=10 && /[가-힣]/.test(cand)) {
            if(!result.has(phone)) result.set(phone, cand);
            break;
          }
        }
      }
    }
    return Array.from(result.entries()).map(([phone,name])=>({name,phone}));
  }

  async function importParsed() {
    if(!onImportCustomers) return;
    const parsed = parseNaverText(naverImportText);
    setImporting(true);
    let added = 0;
    for(const nc of parsed) {
      const exists = CUSTS.find(c=>c.phone.replace(/-/g,"")===nc.phone.replace(/-/g,""));
      if(!exists) {
        const c = {id:Date.now()+added, name:nc.name, phone:nc.phone, birth:"", memo:"", tags:[], visits:0, revenue:0};
        CUSTS = [...CUSTS, c];
        await onImportCustomers(c);
        added++;
      }
    }
    setImporting(false);
    setImportResult(added);
    setNaverImportText("");
  }

  function parseNaverBookings(txt) {
    const ANNOUNCE = ['예약 변경 및 취소 안내','네이버 예약 시간 변동 안내'];
    const STATUS = new Set(["완료","취소","확정","대기","노쇼"]);
    const lines = txt.split('\n').map(l=>l.split('\t')[0].trim()).filter(Boolean);
    const results = [];
    for(let i=0; i<lines.length; i++) {
      const phoneM = lines[i].match(/^(010-\d{4}-\d{4})/);
      if(!phoneM) continue;
      const phone = phoneM[1];
      let name = '';
      for(let j=i-1; j>=Math.max(0,i-4); j--) {
        const cand = lines[j];
        if(STATUS.has(cand) || /^\d/.test(cand) || cand.includes('-') || cand.length<2 || cand.length>15) continue;
        if(/[가-힣A-Za-z]/.test(cand)) { name=cand; break; }
      }
      if(!name) continue;
      let date='', time='', svc='', depAmt=20000;
      let dateFound=false;
      for(let j=i+1; j<Math.min(lines.length,i+12); j++) {
        const line = lines[j];
        if(/^010-\d{4}-\d{4}/.test(line)) break;
        if(!dateFound) {
          const dtM = line.match(/^(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\([가-힣]+\)\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
          if(dtM) {
            const [,yr,mo,dy,ap,hS,mS] = dtM;
            const fullYr = yr.length<=2 ? '20'+yr : yr;
            date = fullYr+'-'+String(mo).padStart(2,'0')+'-'+String(dy).padStart(2,'0');
            let h=Number(hS);
            if(ap==='오후'&&h<12) h+=12;
            if(ap==='오전'&&h===12) h=0;
            time = String(h).padStart(2,'0')+':'+mS;
            dateFound=true;
          }
        } else {
          if(line==='루미네일'||STATUS.has(line)||line==='-') continue;
          const depM = line.match(/결제완료([\d,]+)원/);
          if(depM) { depAmt=parseInt(depM[1].replace(/,/g,'')); continue; }
          if(/^결제/.test(line)||/^\d{2,4}\.\s*\d/.test(line)) break;
          if(!svc) {
            const items = line.split(',').map(s=>s.trim()).filter(s=>s.length>0&&!ANNOUNCE.some(a=>s.includes(a)));
            if(items.length>0) svc=items.join(', ');
          }
        }
      }
      if(date&&name) results.push({name,phone,date,time,svc:svc||'시술 미정',depAmt});
    }
    return results;
  }

  async function importBookings() {
    if(!onImportBookings) return;
    const parsed = parseNaverBookings(naverBkText);
    setBkImporting(true);
    let added=0;
    for(const bk of parsed) {
      const ex = CUSTS.find(c=>c.phone.replace(/-/g,'')===bk.phone.replace(/-/g,''));
      if(!ex) {
        const newC={id:Date.now()+added,name:bk.name,phone:bk.phone,birth:'',memo:'',tags:[],visits:0,revenue:0};
        CUSTS=[...CUSTS,newC];
        if(onImportCustomers) await onImportCustomers(newC);
      }
      const sid=Number(bkImportSid);
      const newBk={id:Date.now()+added+1,sid,date:bk.date,time:bk.time,mins:60,name:bk.name,phone:bk.phone,svc:bk.svc,price:0,dep:'naver_paid',depAmt:bk.depAmt,memo:''};
      await onImportBookings(newBk);
      added++;
    }
    setBkImporting(false);
    setBkImportResult(added);
    setNaverBkText('');
  }
  const [sh, setSh] = useState("10:00");
  const [eh, setEh] = useState("20:00");
  const hrs = Array.from({length:24},(_,i) => String(i).padStart(2,"0")+":00");

  function goBack() { setSub(null); if(onClearSub)onClearSub(); }
  useEffect(() => { if(initialSub)setSub(initialSub); }, [initialSub]);

  if(sub==="staff") return (
    <div style={{minHeight:"100vh",background:BG}}>
      <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:3}}>‹ 뒤로</button>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>직원 관리</span>
        <button onClick={() => {onUpdateStaff(sl);goBack();}} style={{background:P,border:"none",cursor:"pointer",color:WH,fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:10}}>저장</button>
      </div>
      <div style={{background:WH}}>
        {sl.map(s => (
          <div key={s.id} style={{padding:"13px 18px",borderBottom:"1px solid "+G2}}>
            {editId===s.id ? (
              <div style={{display:"flex",gap:7}}>
                <input value={editN} onChange={e => setEditN(e.target.value)}
                  style={{flex:1,padding:"8px 10px",borderRadius:9,border:"1.5px solid "+P,fontSize:13,outline:"none",color:DK,background:WH}}/>
                <button onClick={() => {setSl(p=>p.map(x=>x.id===s.id?{...x,name:editN}:x));setEditId(null);}}
                  style={{padding:"8px 12px",borderRadius:9,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer"}}>저장</button>
                <button onClick={() => setEditId(null)} style={{padding:"8px 10px",borderRadius:9,background:G2,border:"none",fontSize:11,cursor:"pointer"}}>취소</button>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:P}}>{s.name[0]}</div>
                <span style={{flex:1,fontSize:14,fontWeight:600,color:DK}}>{s.name}</span>
                <button onClick={() => {setEditId(s.id);setEditN(s.name);}}
                  style={{padding:"5px 10px",borderRadius:9,background:PL,border:"none",color:P,fontSize:11,fontWeight:600,cursor:"pointer"}}>수정</button>
                <button onClick={() => setSl(p=>p.filter(x=>x.id!==s.id))}
                  style={{padding:"5px 10px",borderRadius:9,background:"#FFF0F0",border:"1px solid "+RD,color:RD,fontSize:11,fontWeight:600,cursor:"pointer"}}>삭제</button>
              </div>
            )}
          </div>
        ))}
        <div style={{padding:"13px 18px"}}>
          <div style={{display:"flex",gap:7}}>
            <input value={newN} onChange={e => setNewN(e.target.value)}
              onKeyDown={e => {if(e.key==="Enter"&&newN.trim()){setSl(p=>[...p,{id:p.length,name:newN.trim(),bg:p.length%2===0?PS:WH}]);setNewN("");}}}
              placeholder="담당자 이름"
              style={{flex:1,padding:"10px 11px",borderRadius:11,border:"1.5px dashed "+PM,fontSize:12,outline:"none",color:DK,background:WH}}/>
            <button onClick={() => {if(!newN.trim())return;setSl(p=>[...p,{id:p.length,name:newN.trim(),bg:p.length%2===0?PS:WH}]);setNewN("");}}
              style={{padding:"10px 14px",borderRadius:11,background:P,border:"none",color:WH,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
          </div>
        </div>
      </div>
    </div>
  );

  if(sub==="time") return (
    <div style={{minHeight:"100vh",background:BG}}>
      <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600}}>‹ 뒤로</button>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>운영시간 설정</span>
        <button onClick={goBack} style={{background:P,border:"none",cursor:"pointer",color:WH,fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:10}}>저장</button>
      </div>
      {[{l:"시작 시간",v:sh,set:setSh},{l:"종료 시간",v:eh,set:setEh}].map(r => (
        <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:"1px solid "+G2,background:WH}}>
          <span style={{fontSize:13,color:G7}}>{r.l}</span>
          <select value={r.v} onChange={e => r.set(e.target.value)} style={{border:"none",background:"transparent",fontSize:14,fontWeight:700,color:DK,outline:"none",cursor:"pointer"}}>
            {hrs.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ))}
      {/* 예약 단위 설정 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:"1px solid "+G2,background:WH}}>
        <div>
          <div style={{fontSize:13,color:G7}}>예약 단위</div>
          <div style={{fontSize:10,color:G5,marginTop:2}}>타임테이블·예약등록에 반영</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[15,30].map(u => (
            <button key={u} onClick={() => onUpdateSlotUnit && onUpdateSlotUnit(u)}
              style={{padding:"7px 16px",borderRadius:10,border:slotUnit===u?"1.5px solid "+PM:"1px solid "+G2,background:slotUnit===u?PL:WH,color:slotUnit===u?P:G7,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {u}분
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if(sub==="account") return (
    <div style={{minHeight:"100vh",background:BG}}>
      <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600}}>‹ 뒤로</button>
        <span style={{fontSize:15,fontWeight:800,color:DK}}>계정 정보</span>
        <div style={{width:40}}/>
      </div>
      <div style={{padding:"18px"}}>
        <div style={{background:WH,borderRadius:14,padding:"16px",marginBottom:16}}>
          <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:6,letterSpacing:0.3}}>로그인 이메일</div>
          <div style={{fontSize:14,fontWeight:600,color:DK}}>{email||"-"}</div>
        </div>
        <div style={{background:WH,borderRadius:14,padding:"16px"}}>
          <div style={{fontSize:13,fontWeight:700,color:DK,marginBottom:14}}>비밀번호 변경</div>
          {[
            {label:"현재 비밀번호",val:pwCurrent,set:setPwCurrent},
            {label:"새 비밀번호",val:pwNew,set:setPwNew},
            {label:"새 비밀번호 확인",val:pwConfirm,set:setPwConfirm},
          ].map(f=>(
            <div key={f.label} style={{marginBottom:12}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:6}}>{f.label}</div>
              <input type="password" value={f.val} onChange={e=>f.set(e.target.value)}
                style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:BG,boxSizing:"border-box"}}/>
            </div>
          ))}
          {pwMsg && <div style={{padding:"10px 13px",borderRadius:10,background:pwMsg.ok?GRL:RD+"20",color:pwMsg.ok?GR:RD,fontSize:12,fontWeight:600,marginBottom:12}}>{pwMsg.text}</div>}
          <button disabled={pwLoading||!pwCurrent||!pwNew||!pwConfirm} onClick={async()=>{
            if(pwNew!==pwConfirm){setPwMsg({ok:false,text:"새 비밀번호가 일치하지 않습니다."});return;}
            if(pwNew.length<6){setPwMsg({ok:false,text:"비밀번호는 6자 이상이어야 합니다."});return;}
            setPwLoading(true);setPwMsg(null);
            try{
              await onChangePassword(pwCurrent,pwNew);
              setPwMsg({ok:true,text:"비밀번호가 변경되었습니다."});
              setPwCurrent("");setPwNew("");setPwConfirm("");
            }catch(e){
              const msg=e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"?"현재 비밀번호가 올바르지 않습니다.":e.code==="auth/too-many-requests"?"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.":"오류가 발생했습니다. 다시 시도해주세요.";
              setPwMsg({ok:false,text:msg});
            }finally{setPwLoading(false);}
          }}
            style={{width:"100%",padding:"13px",borderRadius:13,background:pwLoading||!pwCurrent||!pwNew||!pwConfirm?G2:P,border:"none",color:pwLoading||!pwCurrent||!pwNew||!pwConfirm?G5:WH,fontSize:13,fontWeight:700,cursor:pwLoading||!pwCurrent||!pwNew||!pwConfirm?"default":"pointer"}}>
            {pwLoading?"변경 중...":"비밀번호 변경"}
          </button>
        </div>
      </div>
    </div>
  );
  if(sub==="svcmenu") return <ServiceMenuPage onBack={goBack} uid={uid}/>;
  if(sub==="prepaid") return <PrepaidPage onBack={goBack}/>;

  if(sub==="bonus") {
    const br=bonusRates||{naverpay:0,card:10,cash:20};
    const methods=[{v:"naverpay",l:"N페이"},{v:"card",l:"카드"},{v:"cash",l:"현금"}];
    return (
      <div style={{minHeight:"100vh",background:BG}}>
        <div style={{background:WH,padding:"13px 18px",borderBottom:"1px solid "+G2,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
          <button onClick={goBack} style={{background:"none",border:"none",cursor:"pointer",color:P,fontSize:13,fontWeight:600}}>‹ 뒤로</button>
          <span style={{fontSize:15,fontWeight:800,color:DK}}>선불권 적립 설정</span>
          <button onClick={goBack} style={{background:P,border:"none",cursor:"pointer",color:WH,fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:10}}>저장</button>
        </div>
        <div style={{background:WH}}>
          {methods.map(m => (
            <div key={m.v} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",borderBottom:"1px solid "+G2}}>
              <span style={{fontSize:14,fontWeight:600,color:DK}}>{m.l}</span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={() => onUpdateBonus&&onUpdateBonus({...br,[m.v]:Math.max(0,(br[m.v]||0)-5)})}
                  style={{width:32,height:32,borderRadius:"50%",background:G2,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,color:G7,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                <span style={{fontSize:18,fontWeight:800,color:P,minWidth:40,textAlign:"center"}}>{br[m.v]||0}%</span>
                <button onClick={() => onUpdateBonus&&onUpdateBonus({...br,[m.v]:Math.min(50,(br[m.v]||0)+5)})}
                  style={{width:32,height:32,borderRadius:"50%",background:PL,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,color:P,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingTop:12}}>
      {/* 샵 이름 설정 - 인라인 편집 */}
      <ShopNameSetting shopName={shopName} onUpdate={onUpdateShopName}/>
      {[
        {l:"시술메뉴 관리",s:"시술 항목 추가·수정·삭제",a:()=>setSub("svcmenu")},
        {l:"직원 관리",s:"현재 "+staff.length+"명",a:()=>setSub("staff")},
        {l:"운영시간 설정",s:sh+" ~ "+eh,a:()=>setSub("time")},
        {l:"테마 변경",s:"White Lavender",a:null},
        {l:"공지사항",s:"업데이트 및 공지",a:null},
        {l:"계정 정보",s:email||"",a:()=>setSub("account")},
      ].map((item,i) => (
        <div key={i} onClick={item.a||undefined}
          style={{background:WH,borderBottom:"1px solid "+G2,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:item.a?"pointer":"default"}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:DK}}>{item.l}</div>
            <div style={{fontSize:11,color:G5,marginTop:2}}>{item.s}</div>
          </div>
          <span style={{fontSize:16,color:G3}}>›</span>
        </div>
      ))}
      {onUpdateNaverUrl && (
        <div style={{padding:"14px 18px",background:WH,borderBottom:"1px solid "+G2,borderLeft:"3px solid #03C75A"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:700,color:"#03C75A"}}>네이버 예약 바로가기 URL</div>
            <button onClick={()=>{setNaverUrlEdit(v=>!v);setNaverUrlInput(naverUrl);}} style={{background:"none",border:"none",cursor:"pointer",color:"#03C75A",fontSize:12,fontWeight:600}}>{naverUrlEdit?"닫기":"설정"}</button>
          </div>
          <div style={{fontSize:11,color:G5,marginBottom:naverUrlEdit?10:0}}>
            {naverUrl ? <span>홈 화면 상단 <b style={{color:"#009444"}}>N</b> 버튼으로 바로 이동</span> : "URL 설정 시 홈 상단에 네이버 바로가기 버튼이 생깁니다"}
          </div>
          {naverUrlEdit && (
            <div style={{display:"flex",gap:7}}>
              <input value={naverUrlInput} onChange={e=>setNaverUrlInput(e.target.value)}
                placeholder="https://new.smartplace.naver.com/..."
                style={{flex:1,padding:"9px 11px",borderRadius:9,border:"1.5px solid #03C75A",fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
              <button onClick={()=>{onUpdateNaverUrl(naverUrlInput.trim());setNaverUrlEdit(false);}}
                style={{padding:"9px 14px",borderRadius:9,background:"#03C75A",border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>저장</button>
            </div>
          )}
        </div>
      )}
      {onImportCustomers && (
        <div style={{padding:"14px 18px",background:WH,borderBottom:"1px solid "+G2,borderLeft:"3px solid #03C75A"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:700,color:"#03C75A"}}>N예약 고객 가져오기</div>
            <button onClick={()=>setShowImport(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",color:"#03C75A",fontSize:12,fontWeight:600}}>{showImport?"닫기":"열기"}</button>
          </div>
          <div style={{fontSize:11,color:G5,marginBottom:showImport?10:0}}>네이버 예약관리 페이지 전체 복사 → 붙여넣기로 고객 자동 등록</div>
          {showImport && (
            <div>
              <textarea value={naverImportText} onChange={e=>{setNaverImportText(e.target.value);setImportResult(null);}}
                placeholder={"네이버 예약관리 페이지에서 Ctrl+A → Ctrl+C 후 여기에 붙여넣기"}
                rows={6}
                style={{width:"100%",border:"1.5px solid #03C75A",borderRadius:9,padding:"9px 11px",fontSize:12,color:DK,background:WH,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:8}}/>
              {naverImportText && <div style={{fontSize:11,color:G5,marginBottom:8}}>
                인식된 고객: <b style={{color:P}}>{parseNaverText(naverImportText).length}명</b>
                {" ("}기존 제외 시 {parseNaverText(naverImportText).filter(nc=>!CUSTS.find(c=>c.phone.replace(/-/g,"")===nc.phone.replace(/-/g,""))).length}명 신규{")"}
              </div>}
              {importResult!==null && <div style={{fontSize:12,color:"#009444",fontWeight:600,marginBottom:8}}>✓ {importResult}명 등록 완료</div>}
              <button onClick={importParsed} disabled={importing||!naverImportText}
                style={{width:"100%",padding:"10px",borderRadius:10,background:importing?G2:"#03C75A",border:"none",color:importing?G5:WH,fontSize:13,fontWeight:700,cursor:importing||!naverImportText?"default":"pointer"}}>
                {importing ? "등록 중..." : "고객 등록"}
              </button>
            </div>
          )}
        </div>
      )}
      {onImportBookings && (
        <div style={{padding:"14px 18px",background:WH,borderBottom:"1px solid "+G2,borderLeft:"3px solid #03C75A"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:700,color:"#03C75A"}}>N예약 일괄등록</div>
            <button onClick={()=>{setShowBkImport(v=>!v);setBkImportResult(null);}} style={{background:"none",border:"none",cursor:"pointer",color:"#03C75A",fontSize:12,fontWeight:600}}>{showBkImport?"닫기":"열기"}</button>
          </div>
          <div style={{fontSize:11,color:G5,marginBottom:showBkImport?10:0}}>네이버 예약관리 목록 복사 → 붙여넣기로 예약 일괄 등록</div>
          {showBkImport && (
            <div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:G5,fontWeight:600,marginBottom:4}}>담당 직원</div>
                <select value={bkImportSid} onChange={e=>setBkImportSid(e.target.value)}
                  style={{width:"100%",padding:"8px 10px",borderRadius:9,border:"1.5px solid "+G2,fontSize:12,color:DK,background:WH,outline:"none"}}>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <textarea value={naverBkText} onChange={e=>{setNaverBkText(e.target.value);setBkImportResult(null);}}
                placeholder="네이버 예약관리에서 Ctrl+A 후 Ctrl+C, 여기에 붙여넣기"
                rows={6}
                style={{width:"100%",border:"1.5px solid #03C75A",borderRadius:9,padding:"9px 11px",fontSize:12,color:DK,background:WH,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:8}}/>
              {naverBkText && (() => {
                const bks = parseNaverBookings(naverBkText);
                return (
                  <div style={{fontSize:11,color:G5,marginBottom:8}}>
                    <b style={{color:P}}>{bks.length}건</b> 인식됨
                    <div style={{marginTop:4,maxHeight:110,overflowY:"auto"}}>
                      {bks.map((bk,idx)=>(
                        <div key={idx} style={{fontSize:10,color:G7,padding:"2px 0",borderBottom:"1px solid "+G2}}>
                          {bk.date} {bk.time} {bk.name} — {bk.svc}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {bkImportResult!==null && <div style={{fontSize:12,color:"#009444",fontWeight:600,marginBottom:8}}>✓ {bkImportResult}건 등록 완료</div>}
              <button onClick={importBookings} disabled={bkImporting||!naverBkText}
                style={{width:"100%",padding:"10px",borderRadius:10,background:bkImporting||!naverBkText?G2:P,border:"none",color:bkImporting||!naverBkText?G5:WH,fontSize:13,fontWeight:700,cursor:bkImporting||!naverBkText?"default":"pointer"}}>
                {bkImporting?"등록 중...":"예약 등록"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 문자 발송 페이지 ──────────────────────────────────
const DEFAULT_SMS_TEMPLATES = [
  {id:"deposit",   category:"예약", label:"예약대기 · 예약금 안내",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n{날짜} {시간} 예약이 접수되었습니다.\n예약 확정을 위해 예약금을 입금해 주세요.\n[계좌번호 입력]\n입금 확인 후 예약 확정 안내 드리겠습니다. 감사합니다."},
  {id:"confirm",   category:"예약", label:"예약 확정",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n{날짜} {시간} {시술명} 예약이 확정되었습니다.\n당일 방문 시 편하게 연락 주세요. 감사합니다 :)"},
  {id:"remind",    category:"예약", label:"예약 리마인드",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n내일 {시간} {시술명} 예약 리마인드 문자 드립니다.\n취소·변경이 필요하신 경우 미리 연락 주시면 감사하겠습니다."},
  {id:"cancel",    category:"예약", label:"예약 취소",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n요청하신 {날짜} {시간} 예약이 취소 처리되었습니다.\n다음에 또 방문해 주세요. 감사합니다."},
  {id:"noshow",    category:"예약", label:"노쇼 안내",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n오늘 {시간} 예약에 별도 연락 없이 방문하지 않으셔서 노쇼 처리되었습니다.\n노쇼 발생 시 향후 예약이 제한될 수 있으니 양해 부탁드립니다."},
  {id:"prepaid_charge",  category:"회원권", label:"선불권 충전 완료",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n선불권 {금액} 충전이 완료되었습니다.\n현재 잔액: {잔액}\n감사합니다."},
  {id:"prepaid_balance", category:"회원권", label:"선불권 잔액 안내",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n현재 선불권 잔액은 {잔액}입니다.\n다음 방문 시 편리하게 이용해 주세요. 감사합니다."},
  {id:"prepaid_low",     category:"회원권", label:"선불권 잔액 부족",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n선불권 잔액이 {잔액}으로 부족합니다.\n다음 방문 전 충전하시면 더 편리하게 이용하실 수 있습니다. 감사합니다."},
  {id:"membership_expire", category:"회원권", label:"회원권 만료 안내",
   body:"안녕하세요 {이름}님, {샵이름}입니다.\n회원권 유효기간이 얼마 남지 않았습니다.\n기간 내 사용하지 않으시면 잔액이 소멸될 수 있으니 방문 예약 부탁드립니다. 감사합니다."},
];

function SmsSendPage({ shopName, uid }) {
  const SKEY = `smsTemplates_${uid||"local"}`;
  const [templates, setTemplates] = useState(() => {
    try { const s=localStorage.getItem(SKEY); return s?JSON.parse(s):DEFAULT_SMS_TEMPLATES; } catch { return DEFAULT_SMS_TEMPLATES; }
  });
  const [activeCategory, setActiveCategory] = useState("예약");
  const [editId, setEditId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [sendTmpl, setSendTmpl] = useState(null);
  const [custQ, setCustQ] = useState("");
  const [selCust, setSelCust] = useState(null);
  const [vars, setVars] = useState({date:TODAY,time:"",svc:"",amount:"",balance:""});
  const [finalBody, setFinalBody] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTmpl, setNewTmpl] = useState({category:"예약",label:"",body:""});

  const categories = [...new Set(templates.map(t=>t.category))];

  function saveTemplate(id, body) {
    const next = templates.map(t=>t.id===id?{...t,body}:t);
    setTemplates(next);
    localStorage.setItem(SKEY, JSON.stringify(next));
    setEditId(null);
  }
  function resetTemplate(id) {
    const def = DEFAULT_SMS_TEMPLATES.find(t=>t.id===id);
    if (!def) return;
    saveTemplate(id, def.body);
  }
  function fillVars(body) {
    return body
      .replace(/\{이름\}/g, selCust?.name||"")
      .replace(/\{샵이름\}/g, shopName||"")
      .replace(/\{날짜\}/g, vars.date||"")
      .replace(/\{시간\}/g, vars.time||"")
      .replace(/\{시술명\}/g, vars.svc||"")
      .replace(/\{금액\}/g, vars.amount?Number(vars.amount).toLocaleString()+"원":"")
      .replace(/\{잔액\}/g, vars.balance?Number(vars.balance).toLocaleString()+"원":"");
  }
  function openSend(tmpl) {
    setSendTmpl(tmpl);
    setSelCust(null); setCustQ("");
    setVars({date:TODAY,time:"",svc:"",amount:"",balance:""});
    setFinalBody(tmpl.body.replace(/\{샵이름\}/g, shopName||""));
  }
  function closeSend() { setSendTmpl(null); setSelCust(null); setCustQ(""); }
  function addTemplate() {
    const cat = newTmpl.category.trim() || "기타";
    if(!newTmpl.label.trim() || !newTmpl.body.trim()) return;
    const tmpl = {id:"custom_"+Date.now(), category:cat, label:newTmpl.label.trim(), body:newTmpl.body.trim()};
    const next = [...templates, tmpl];
    setTemplates(next);
    localStorage.setItem(SKEY, JSON.stringify(next));
    setShowAdd(false);
    setNewTmpl({category:"예약",label:"",body:""});
    setActiveCategory(cat);
  }
  function deleteTemplate(id) {
    if(!window.confirm("삭제하시겠습니까?")) return;
    const next = templates.filter(t=>t.id!==id);
    setTemplates(next);
    localStorage.setItem(SKEY, JSON.stringify(next));
  }

  // 고객 선택 시 이름·최근예약 자동 채우기
  function pickCust(c) {
    setSelCust(c);
    setCustQ(c.name);
    const lastBk = BKS.filter(b=>b.name===c.name).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const nextVars = {...vars};
    if(lastBk) { nextVars.date=lastBk.date||vars.date; nextVars.time=lastBk.time||""; nextVars.svc=lastBk.svc||""; }
    setVars(nextVars);
    if(sendTmpl) setFinalBody(fillVarsWith(sendTmpl.body, c, nextVars));
  }
  function fillVarsWith(body, cust, v) {
    return body
      .replace(/\{이름\}/g, cust?.name||"")
      .replace(/\{샵이름\}/g, shopName||"")
      .replace(/\{날짜\}/g, v.date||"")
      .replace(/\{시간\}/g, v.time||"")
      .replace(/\{시술명\}/g, v.svc||"")
      .replace(/\{금액\}/g, v.amount?Number(v.amount).toLocaleString()+"원":"")
      .replace(/\{잔액\}/g, v.balance?Number(v.balance).toLocaleString()+"원":"");
  }
  function updateVars(k, val) {
    const next = {...vars,[k]:val};
    setVars(next);
    if(sendTmpl) setFinalBody(fillVarsWith(sendTmpl.body, selCust, next));
  }

  const custSuggestions = custQ && !selCust
    ? CUSTS.filter(c=>c.name.includes(custQ)||c.phone.replace(/-/g,"").includes(custQ.replace(/-/g,""))).slice(0,5)
    : [];

  const neededVars = sendTmpl ? {
    date:    sendTmpl.body.includes("{날짜}"),
    time:    sendTmpl.body.includes("{시간}"),
    svc:     sendTmpl.body.includes("{시술명}"),
    amount:  sendTmpl.body.includes("{금액}"),
    balance: sendTmpl.body.includes("{잔액}"),
  } : {};

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:"16px 18px 12px",background:WH,borderBottom:"1px solid "+G2,position:"sticky",top:0,zIndex:10,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <span style={{fontSize:16,fontWeight:800,color:DK}}>문자 발송</span>
          <div style={{fontSize:11,color:G5,marginTop:3}}>템플릿을 편집하고 고객에게 바로 발송하세요</div>
        </div>
        <button onClick={()=>setShowAdd(true)}
          style={{padding:"7px 13px",borderRadius:9,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>+ 추가</button>
      </div>

      <div style={{display:"flex",gap:7,padding:"12px 18px 0",overflowX:"auto"}}>
        {categories.map(cat=>(
          <button key={cat} onClick={()=>setActiveCategory(cat)}
            style={{padding:"6px 16px",borderRadius:20,border:"none",background:activeCategory===cat?P:G2,color:activeCategory===cat?WH:G7,fontSize:12,fontWeight:activeCategory===cat?700:500,cursor:"pointer",flexShrink:0}}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{padding:"12px 18px"}}>
        {templates.filter(tp=>tp.category===activeCategory).map(tp=>(
          <div key={tp.id} style={{background:WH,borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid "+G2,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:DK}}>{tp.label}</span>
              {editId!==tp.id && (
                <div style={{display:"flex",gap:5}}>
                  {!DEFAULT_SMS_TEMPLATES.some(d=>d.id===tp.id) && (
                    <button onClick={()=>deleteTemplate(tp.id)}
                      style={{padding:"4px 10px",borderRadius:8,background:"#FFF0F0",border:"none",color:RD,fontSize:11,fontWeight:600,cursor:"pointer"}}>삭제</button>
                  )}
                  <button onClick={()=>{setEditId(tp.id);setEditBody(tp.body);}}
                    style={{padding:"4px 10px",borderRadius:8,background:OB,border:"none",color:P,fontSize:11,fontWeight:600,cursor:"pointer"}}>편집</button>
                </div>
              )}
            </div>

            {editId===tp.id ? (
              <div>
                <textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={6}
                  style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+P,fontSize:12,color:DK,background:WH,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.8}}/>
                <div style={{fontSize:10,color:G5,marginBottom:8,marginTop:4}}>
                  사용 가능한 변수: {["{이름}","{날짜}","{시간}","{시술명}","{샵이름}","{금액}","{잔액}"].join("  ")}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {DEFAULT_SMS_TEMPLATES.some(d=>d.id===tp.id) && (
                    <button onClick={()=>resetTemplate(tp.id)}
                      style={{flex:1,padding:"9px",borderRadius:10,background:G2,border:"none",color:G7,fontSize:12,fontWeight:600,cursor:"pointer"}}>초기화</button>
                  )}
                  <button onClick={()=>setEditId(null)}
                    style={{flex:1,padding:"9px",borderRadius:10,background:G2,border:"none",color:G7,fontSize:12,fontWeight:600,cursor:"pointer"}}>취소</button>
                  <button onClick={()=>saveTemplate(tp.id,editBody)}
                    style={{flex:2,padding:"9px",borderRadius:10,background:P,border:"none",color:WH,fontSize:12,fontWeight:700,cursor:"pointer"}}>저장</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:12,color:G7,lineHeight:1.8,marginBottom:10,whiteSpace:"pre-wrap",background:PS,borderRadius:9,padding:"10px 12px"}}>{tp.body}</div>
                <button onClick={()=>openSend(tp)}
                  style={{width:"100%",padding:"10px",borderRadius:10,background:PL,border:"1px solid "+PM,color:P,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  문자 보내기
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 문자 보내기 시트 */}
      {sendTmpl && (
        <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget)closeSend();}}>
          <div style={{width:"100%",maxWidth:430,background:WH,borderRadius:"22px 22px 0 0",padding:"20px 18px 44px",maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontSize:14,fontWeight:800,color:DK,marginBottom:14}}>{sendTmpl.label}</div>

            {/* 고객 검색 */}
            <div style={{marginBottom:12,position:"relative"}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>고객</div>
              <input value={custQ} onChange={e=>{setCustQ(e.target.value);if(selCust)setSelCust(null);}}
                placeholder="이름 또는 전화번호"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+(selCust?P:G2),fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
              {custSuggestions.length>0 && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:WH,borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",border:"1px solid "+G2,zIndex:10,overflow:"hidden"}}>
                  {custSuggestions.map(c=>(
                    <div key={c.id} onClick={()=>pickCust(c)}
                      style={{padding:"10px 14px",borderBottom:"1px solid "+G2,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:P,flexShrink:0}}>{c.name[0]}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:DK}}>{c.name}</div>
                        <div style={{fontSize:11,color:G5}}>{c.phone}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 변수 입력 */}
            {Object.values(neededVars).some(Boolean) && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {neededVars.date && (
                  <div>
                    <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>날짜</div>
                    <input value={vars.date} onChange={e=>updateVars("date",e.target.value)} type="date"
                      style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                  </div>
                )}
                {neededVars.time && (
                  <div>
                    <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>시간</div>
                    <input value={vars.time} onChange={e=>updateVars("time",e.target.value)} placeholder="10:00"
                      style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                  </div>
                )}
                {neededVars.svc && (
                  <div style={{gridColumn:"1/-1"}}>
                    <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>시술명</div>
                    <input value={vars.svc} onChange={e=>updateVars("svc",e.target.value)} placeholder="젤네일 아트"
                      style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                  </div>
                )}
                {neededVars.amount && (
                  <div>
                    <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>금액</div>
                    <input value={vars.amount} onChange={e=>updateVars("amount",e.target.value)} type="number" placeholder="50000"
                      style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                  </div>
                )}
                {neededVars.balance && (
                  <div>
                    <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>잔액</div>
                    <input value={vars.balance} onChange={e=>updateVars("balance",e.target.value)} type="number" placeholder="30000"
                      style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
                  </div>
                )}
              </div>
            )}

            {/* 미리보기 (직접 편집 가능) */}
            <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>문자 내용 (직접 수정 가능)</div>
            <textarea value={finalBody} onChange={e=>setFinalBody(e.target.value)} rows={6}
              style={{width:"100%",padding:"12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,color:DK,background:PS,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.8,marginBottom:12}}/>

            <div style={{display:"flex",gap:8}}>
              <button onClick={closeSend}
                style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:13,fontWeight:600,cursor:"pointer"}}>취소</button>
              <a href={`sms:${selCust?.phone||""}&body=${encodeURIComponent(finalBody)}`}
                onClick={()=>setTimeout(closeSend,300)}
                style={{flex:2,padding:"13px",borderRadius:13,background:selCust?.phone?P:G3,color:WH,fontSize:13,fontWeight:700,textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6,pointerEvents:selCust?.phone?"auto":"none"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WH} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {selCust?.phone ? "문자 보내기" : "고객을 먼저 선택하세요"}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 템플릿 추가 시트 */}
      {showAdd && (
        <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget){setShowAdd(false);setNewTmpl({category:"예약",label:"",body:""});}}}>
          <div style={{width:"100%",maxWidth:430,background:WH,borderRadius:"22px 22px 0 0",padding:"20px 18px 44px",maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontSize:14,fontWeight:800,color:DK,marginBottom:16}}>템플릿 추가</div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>카테고리</div>
              <input list="cat-list" value={newTmpl.category}
                onChange={e=>setNewTmpl(p=>({...p,category:e.target.value}))}
                placeholder="예약 / 회원권 / 기타"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
              <datalist id="cat-list">
                {categories.map(c=><option key={c} value={c}/>)}
              </datalist>
            </div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>제목</div>
              <input value={newTmpl.label} onChange={e=>setNewTmpl(p=>({...p,label:e.target.value}))}
                placeholder="예) 생일 축하 문자"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:13,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
            </div>

            <div style={{marginBottom:6}}>
              <div style={{fontSize:10,color:G5,fontWeight:700,marginBottom:5}}>내용</div>
              <textarea value={newTmpl.body} onChange={e=>setNewTmpl(p=>({...p,body:e.target.value}))} rows={6}
                placeholder="문자 내용을 입력하세요"
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+G2,fontSize:12,color:DK,background:WH,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.8}}/>
              <div style={{fontSize:10,color:G5,marginTop:4}}>
                사용 가능한 변수: {"{이름}  {날짜}  {시간}  {시술명}  {샵이름}  {금액}  {잔액}"}
              </div>
            </div>

            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={()=>{setShowAdd(false);setNewTmpl({category:"예약",label:"",body:""});}}
                style={{flex:1,padding:"13px",borderRadius:13,background:G2,border:"none",color:G7,fontSize:13,fontWeight:600,cursor:"pointer"}}>취소</button>
              <button onClick={addTemplate} disabled={!newTmpl.label.trim()||!newTmpl.body.trim()}
                style={{flex:2,padding:"13px",borderRadius:13,background:(!newTmpl.label.trim()||!newTmpl.body.trim())?G3:P,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 앱 루트 ───────────────────────────────────────────
export default function App({ session, onLogout, onChangePassword }) {
  const uid = session?.uid;
  // 저장된 시술메뉴를 앱 시작 시 복원
  try { const s = localStorage.getItem(`svcMenu_${uid||"local"}`); if(s) SVCS = JSON.parse(s); } catch {}
  // Firestore 컬렉션 경로 헬퍼
  const col = (name) => collection(db, "modu_shops", uid, name);
  const ref = (name, id) => doc(db, "modu_shops", uid, name, id);

  const [isDark, setIsDark] = useState(() => { try { return JSON.parse(localStorage.getItem('isDark')||'false'); } catch { return false; } });
  applyTheme(isDark);

  const [tab, setTab] = useState("home");
  const [menuOpen, setMenu] = useState(false);
  const [ttDate, setTtDate] = useState(TODAY);
  const [shopName, setShopName] = useState(() => localStorage.getItem("shopName") || session?.shopName || "Modu Beauty");
  const [naverUrl, setNaverUrl] = useState(() => localStorage.getItem("naverUrl") || "");
  const [modal, setModal] = useState(null);
  const [settingsSub, setSettingsSub] = useState(null);
  const [staff, setStaff] = useState([{id:0,name:"담당자1",bg:PS},{id:1,name:"담당자2",bg:WH}]);

  // ── Firebase 연동 데이터 ──────────────────────────
  const [bookings, setBookings] = useState([]); // Firestore 예약 목록
  const [customers, setCustomers] = useState([]); // Firestore 고객 목록
  const [dbLoading, setDbLoading] = useState(true);

  // 선불권 데이터 — App state로 관리 (localStorage에서 동기 초기화)
  const [prepaidData, setPrepaidData] = useState(() => {
    const uid0 = session?.uid;
    if(!uid0) return [];
    try { return JSON.parse(localStorage.getItem('prepaid_'+uid0)||'[]'); } catch { return []; }
  });
  // prepaidData 변경 시 localStorage + 전역 PREPAID_DATA 동기화
  useEffect(() => {
    PREPAID_DATA = prepaidData;
    if(uid) localStorage.setItem('prepaid_'+uid, JSON.stringify(prepaidData));
  }, [prepaidData, uid]);

  // 다크모드 퍼시스트 + 스태프 배경 동기화 + body 배경
  useEffect(() => {
    localStorage.setItem('isDark', JSON.stringify(isDark));
    setStaff(prev => prev.map((s, i) => ({...s, bg: i%2===0 ? PS : WH})));
    document.body.style.background = BG;
  }, [isDark]);
  // 최초 1회: localStorage 비어있고 paidBks에 선불권 결제 있으면 복원
  const [prepaidBuilt, setPrepaidBuilt] = useState(false);
  useEffect(() => {
    if(prepaidBuilt || prepaidData.length>0 || bookings.length===0) return;
    const built = buildPrepaidFromPaidBks(paidBks);
    if(built.length>0) setPrepaidData(built);
    setPrepaidBuilt(true);
  }, [bookings]);

  useEffect(() => {
    if(!uid) return;
    const q = query(col("bookings"), orderBy("date","asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({...d.data(), firestoreId: d.id}));
      setBookings(data);
      // 전역 BKS도 동기화 (기존 컴포넌트들이 BKS를 직접 참조하므로)
      BKS = data;
      setDbLoading(false);
    }, () => setDbLoading(false));
    return () => unsub();
  }, [uid]);

  // 고객 실시간 구독
  useEffect(() => {
    if(!uid) return;
    const unsub = onSnapshot(col("customers"), (snap) => {
      const data = snap.docs.map(d => ({...d.data(), firestoreId: d.id}));
      setCustomers(data);
      CUSTS = data;
    });
    return () => unsub();
  }, [uid]);

  // 예약 추가
  async function addBooking(bk) {
    if(!uid) return;
    const docRef = await addDoc(col("bookings"), {...bk, createdAt: serverTimestamp()});
    return docRef.id;
  }

  // 예약 수정
  async function updateBooking(firestoreId, data) {
    if(!uid || !firestoreId) return;
    await updateDoc(ref("bookings", firestoreId), data);
  }

  // 예약 삭제
  async function removeBooking(firestoreId) {
    if(!uid || !firestoreId) return;
    await deleteDoc(ref("bookings", firestoreId));
  }

  // 고객 추가/수정
  async function saveCustomer(cust) {
    if(!uid) return;
    if(cust.firestoreId) {
      await updateDoc(ref("customers", cust.firestoreId), cust);
    } else {
      await addDoc(col("customers"), {...cust, createdAt: serverTimestamp()});
    }
  }
  async function deleteCustomer(cust) {
    if(!uid || !cust.firestoreId) return;
    await deleteDoc(ref("customers", cust.firestoreId));
    CUSTS = CUSTS.filter(c => c.id !== cust.id);
  }
  // ─────────────────────────────────────────────────

  const [showPay, setShowPay] = useState(null);
  const [payDone, setPayDone] = useState(null);
  const [payMethod, setPayMethod] = useState("");
  const [payMemo, setPayMemo] = useState("");
  const [paidBks, setPaidBks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`paidBks_${session?.uid}`) || "{}"); } catch { return {}; }
  });
  const [chargeAmt, setChargeAmt] = useState("");
  const [payBonus, setPayBonus] = useState("");
  const [finalAmt, setFinalAmt] = useState("");
  const [bonusRates, setBonusRates] = useState(() => { try { const s=localStorage.getItem("bonusRates"); return s?JSON.parse(s):{naverpay:0,card:10,cash:20}; } catch { return {naverpay:0,card:10,cash:20}; } });
  // 결제취소 확인 모달
  const [confirmCancel, setConfirmCancel] = useState(null);
  // 제품 추가
  const [productItems, setProductItems] = useState([]);
  // 복합결제
  const [splitMode, setSplitMode] = useState(false);
  const [splitItems, setSplitItems] = useState([]); // [{v,l,amount}]
  // 시술 기록
  const [showRecord, setShowRecord] = useState(null);
  const [treatmentRecords, setTreatmentRecords] = useState({});
  // 예약 단위 (15분 or 30분)
  const [slotUnit, setSlotUnit] = useState(30);

  useEffect(() => {
    if(uid) localStorage.setItem(`paidBks_${uid}`, JSON.stringify(paidBks));
  }, [paidBks, uid]);

  function openPayment(bk) { setShowPay(bk); setPayMethod(""); setPayMemo(""); setChargeAmt(""); setPayBonus(""); setProductItems([]); setFinalAmt(""); setSplitMode(false); setSplitItems([]); }
  function openRecord(bk) { setShowRecord(bk); }
  function requestCancelPay(bkId, bkName) {
    setConfirmCancel({ id: bkId, name: bkName });
  }
  function cancelPayment(bkId) {
    const p = paidBks[bkId];
    const custName = p?.custName || BKS.find(b=>String(b.id)===String(bkId))?.name;
    if(p && custName) {
      setPrepaidData(prev => {
        const idx = prev.findIndex(d=>d.custName===custName);
        if(idx<0) return prev;
        let rec = {...prev[idx]};
        if(p.method==="선불권 사용") {
          rec.balance = (rec.balance||0) + (p.paidAmt||0);
          rec.history = rec.history.filter(h=>!(h.date===p.date&&h.type==="use"&&h.amount===p.paidAmt));
        } else if(p.method&&p.method.includes("선불권 충전")) {
          const charge=(p.chargeAmt||0)+(p.chargeBonus||0);
          rec.total = Math.max(0,(rec.total||0)-charge);
          rec.balance = (rec.balance||0) - charge + (p.paidAmt||0);
          rec.history = rec.history.filter(h=>!(h.date===p.date&&((h.type==="charge"&&h.amount===charge)||(h.type==="use"&&h.amount===(p.paidAmt||0)))));
        }
        if(rec.total<=0 && rec.history.length===0) return prev.filter((_,i)=>i!==idx);
        return prev.map((d,i)=>i===idx?rec:d);
      });
      // 고객 누적매출/방문횟수 되돌리기
      const cust = CUSTS.find(c=>c.name===custName);
      if(cust) {
        const updated = {...cust, visits:Math.max(0,(cust.visits||0)-1), revenue:Math.max(0,(cust.revenue||0)-(p.amount||0))};
        CUSTS = CUSTS.map(c=>c.id===cust.id?updated:c);
        saveCustomer(updated);
      }
    }
    setPaidBks(prev => { const n={...prev}; delete n[bkId]; return n; });
    setConfirmCancel(null);
  }
  function saveRecord(updated) {
    BKS = BKS.map(b => b.id===updated.id ? updated : b);
    setTreatmentRecords(p => ({...p,[updated.id]:updated}));
  }

  function completePayment() {
    if(!showPay) return;
    const price = finalAmt ? Number(finalAmt) : showPay.price;
    const depAmt = showPay.depAmt || 0;
    const prodTotal = productItems.reduce((s,x) => s+(Number(x.price)||0), 0);
    const paidAmt = Math.max(0, price - depAmt) + prodTotal;
    const prodMemo = productItems.filter(x=>x.name).map(x=>x.name+(x.price?" "+Number(x.price).toLocaleString()+"원":"")).join(", ");
    const bkDate = showPay.date||TODAY;

    // ── 복합결제 처리 ──
    if(splitMode) {
      if(splitItems.length < 1) return;
      const splitTotal = splitItems.reduce((s,x)=>s+(Number(x.amount)||0),0);
      if(splitTotal !== paidAmt) return;
      const methodLabel = splitItems.map(x=>`${x.l} ${Number(x.amount).toLocaleString()}원`).join("+");
      setPaidBks(p=>({...p,[showPay.id]:{method:methodLabel,amount:price,paidAmt,depAmt,prodTotal,prodMemo,bonus:0,date:bkDate,custName:showPay.name}}));
      const cust2=CUSTS.find(c=>c.name===showPay.name);
      if(cust2){const upd={...cust2,visits:(cust2.visits||0)+1,revenue:(cust2.revenue||0)+price};CUSTS=CUSTS.map(c=>c.id===cust2.id?upd:c);saveCustomer(upd);}
      setShowPay(null);setPayMethod("");setPayMemo("");setChargeAmt("");setPayBonus("");setProductItems([]);setFinalAmt("");setSplitMode(false);setSplitItems([]);
      return;
    }

    if(!payMethod) return;
    if(payMethod==="prepaid_new"&&!chargeAmt) return;
    const charge = Number(chargeAmt)||0;
    const rate = bonusRates[payMethod]||0;
    const bonus = payMethod==="prepaid_new" ? (Number(payBonus)||0) : Math.round(paidAmt * rate / 100);
    const methodLabel =
      payMethod==="naverpay"   ? "N페이"  :
      payMethod==="card"       ? "카드"    :
      payMethod==="cash"       ? "현금"    :
      payMethod==="prepaid"    ? "선불권 사용" :
      payMethod==="prepaid_new"? "선불권 충전 "+charge.toLocaleString()+"원" :
      payMemo || "기타";

    setPaidBks(p => ({
      ...p,
      [showPay.id]: {
        method: methodLabel,
        amount: price,
        paidAmt,
        depAmt,
        prodTotal,
        prodMemo,
        bonus,
        date: bkDate,
        custName: showPay.name,
        ...(payMethod==="prepaid_new" ? {chargeAmt: charge, chargeBonus: bonus} : {}),
      }
    }));

    setPrepaidData(prev => {
      let nd = [...prev];
      const name = showPay.name;
      const idx = nd.findIndex(d=>d.custName===name);
      if(payMethod==="prepaid") {
        const bkDate=showPay.date||TODAY;
        if(idx>=0) nd[idx]={...nd[idx],balance:Math.max(0,nd[idx].balance-paidAmt),history:[...nd[idx].history,{id:Date.now(),type:"use",amount:paidAmt,date:bkDate,memo:showPay.svc+" 결제"}]};
      } else if(payMethod==="prepaid_new") {
        const bkDate=showPay.date||TODAY;
        const chargeMemo=charge.toLocaleString()+"원 충전"+(bonus>0?" (+보너스 "+bonus.toLocaleString()+"원)":"");
        if(idx>=0) {
          nd[idx]={...nd[idx],total:nd[idx].total+charge+bonus,balance:nd[idx].balance+charge+bonus-paidAmt,
            history:[...nd[idx].history,{id:Date.now(),type:"charge",amount:charge+bonus,date:bkDate,memo:chargeMemo},{id:Date.now()+1,type:"use",amount:paidAmt,date:bkDate,memo:showPay.svc+" 결제"}]};
        } else {
          nd=[...nd,{custId:Date.now(),custName:name,balance:charge+bonus-paidAmt,total:charge+bonus,
            history:[{id:1,type:"charge",amount:charge+bonus,date:bkDate,memo:chargeMemo},{id:2,type:"use",amount:paidAmt,date:bkDate,memo:showPay.svc+" 결제"}]}];
        }
      } else if(bonus>0) {
        const bkDate=showPay.date||TODAY;
        if(idx>=0) nd[idx]={...nd[idx],balance:nd[idx].balance+bonus,total:nd[idx].total+bonus,history:[...nd[idx].history,{id:Date.now(),type:"charge",amount:bonus,date:bkDate,memo:methodLabel+" 결제 적립 보너스"}]};
        else nd=[...nd,{custId:Date.now(),custName:name,balance:bonus,total:bonus,history:[{id:1,type:"charge",amount:bonus,date:bkDate,memo:methodLabel+" 결제 적립 보너스"}]}];
      }
      return nd;
    });
    // 고객 누적매출/방문횟수 업데이트
    const cust = CUSTS.find(c=>c.name===showPay.name);
    if(cust) {
      const updated = {...cust, visits:(cust.visits||0)+1, revenue:(cust.revenue||0)+price};
      CUSTS = CUSTS.map(c=>c.id===cust.id?updated:c);
      saveCustomer(updated);
    }

    if(payMethod==='prepaid'||payMethod==='prepaid_new') {
      const custPhone = CUSTS.find(c=>c.name===showPay.name)?.phone||'';
      const prevRec = prepaidData.find(d=>d.custName===showPay.name);
      const prevBal = prevRec ? prevRec.balance : 0;
      const newBal = payMethod==='prepaid' ? Math.max(0,prevBal-paidAmt) : Math.max(0,prevBal+charge+bonus-paidAmt);
      const todayStr = TODAY.slice(5).replace('-','.' );
      setPayDone({name:showPay.name, phone:custPhone, date:todayStr, svc:showPay.svc, amount:paidAmt, prepaidBal:newBal});
    }
    setShowPay(null); setPayMethod(""); setPayMemo(""); setChargeAmt(""); setPayBonus(""); setProductItems([]); setFinalAmt(""); setSplitMode(false); setSplitItems([]);
  }

  function handleDate(ds) { setTtDate(ds); setTab("timetable"); }
  function openModal(time,sid,date) { setModal({time:time||null,sid:sid!==undefined?sid:null,date:date||null}); }
  function addStaff() { setStaff(p => [...p,{id:p.length,name:"담당자"+(p.length+1),bg:p.length%2===0?PS:WH}]); }

  const NAV_L = [
    {id:"home",l:"홈",ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:"calendar",l:"캘린더",ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>},
  ];
  const NAV_R = [
    {id:"customer",l:"고객",ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>},
    {id:"sales",l:"매출",ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>},
  ];
  const menus = [
    {l:"고객관리",a:()=>{setTab("customer");setMenu(false);}},
    {l:"회원권관리",a:()=>{setTab("prepaid");setMenu(false);}},
    {l:"매출분석",a:()=>{setTab("sales");setMenu(false);}},
    {l:"문자발송",a:()=>{setTab("sms");setMenu(false);}},
  ];

  if(dbLoading) return (
    <div style={{minHeight:"100vh",background:"#7C6BC4",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Noto Sans KR',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:18,background:"rgba(255,255,255,0.2)",margin:"0 auto 14px",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <rect x="16" y="2" width="4" height="15" rx="2" fill="rgba(255,255,255,0.95)"/>
            <ellipse cx="18" cy="19" rx="5.5" ry="3.5" fill="white"/>
            <ellipse cx="18" cy="22" rx="4" ry="2.2" fill="rgba(255,255,255,0.7)"/>
          </svg>
        </div>
        <p style={{color:"rgba(255,255,255,0.9)",fontSize:16,fontFamily:"Georgia,serif",letterSpacing:2}}>Modu Beauty</p>
        <p style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:4}}>데이터 불러오는 중...</p>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",background:BG,minHeight:"100vh",width:"100%",maxWidth:430,margin:"0 auto",paddingBottom:72,overflowX:"hidden",boxSizing:"border-box"}}>
      {tab!=="timetable" && (
        <div style={{position:"sticky",top:0,zIndex:50,background:WH,borderBottom:"1px solid "+G2,padding:"13px 18px 11px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
            <button onClick={() => setMenu(true)} style={{background:"none",border:"none",cursor:"pointer",padding:3,display:"flex",flexDirection:"column",gap:4}}>
              <div style={{width:20,height:2,background:DK,borderRadius:2}}/><div style={{width:20,height:2,background:DK,borderRadius:2}}/><div style={{width:13,height:2,background:DK,borderRadius:2}}/>
            </button>
            <span style={{position:"absolute",left:"50%",transform:"translateX(-50%)",fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:P,letterSpacing:-0.5,whiteSpace:"nowrap",pointerEvents:"none"}}>{shopName}</span>
            {naverUrl ? (
              <a href={naverUrl} target="_blank" rel="noreferrer"
                style={{padding:"4px 9px",borderRadius:8,background:"#E8F9EE",border:"1px solid #03C75A",color:"#009444",fontSize:11,fontWeight:800,textDecoration:"none",lineHeight:1.4}}>N</a>
            ) : <div style={{width:26}}/>}
          </div>
        </div>
      )}

      <div>
        {tab==="home" && <HomePage onDate={handleDate} staff={staff} onPay={openPayment} paidBks={paidBks} onCancelPay={requestCancelPay} slotUnit={slotUnit} onDelete={b=>{ if(paidBks[b.id]) cancelPayment(b.id); removeBooking(b.firestoreId); }} onDeletePaid={bkId=>{setPaidBks(p=>{const n={...p};delete n[bkId];return n;}); }} onUpdate={(b,data)=>{updateBooking(b.firestoreId,data);const idx=BKS.findIndex(x=>x.id===b.id);if(idx>=0)BKS[idx]={...BKS[idx],...data};}}/>}
        {tab==="timetable" && <TT date={ttDate} onAdd={openModal} staff={staff} onPay={openPayment} paidBks={paidBks} treatmentRecords={treatmentRecords} onRecord={openRecord} onCancelPay={requestCancelPay} onDelete={b=>{ if(paidBks[b.id]) cancelPayment(b.id); removeBooking(b.firestoreId); }} onUpdate={(b,data)=>{updateBooking(b.firestoreId,data);const idx=BKS.findIndex(x=>x.id===b.id);if(idx>=0)BKS[idx]={...BKS[idx],...data};}} slotUnit={slotUnit}/>}
        {tab==="calendar" && <CalPage onDate={handleDate}/>}
        {tab==="customer" && <CustPage onSaveNew={saveCustomer} paidBks={paidBks} prepaidData={prepaidData} onDeleteBooking={b=>{ if(paidBks[b.id]) cancelPayment(b.id); removeBooking(b.firestoreId); }} onDeleteCust={deleteCustomer}/>}
        {tab==="sales" && <SalesPage paidBks={paidBks} onDeletePaid={bkId=>{setPaidBks(p=>{const n={...p};delete n[bkId];return n;});}}/>}
        {tab==="prepaid" && <PrepaidPage onBack={() => setTab("home")} bonusRates={bonusRates} onUpdateBonus={r=>{setBonusRates(r);localStorage.setItem("bonusRates",JSON.stringify(r));}} prepaidData={prepaidData} onPrepaidUpdate={setPrepaidData}/>}
        {tab==="sms" && <SmsSendPage shopName={shopName} uid={uid}/>}
        {tab==="settings" && <SettingsPage staff={staff} onUpdateStaff={s=>setStaff(s)} initialSub={settingsSub} onClearSub={() => setSettingsSub(null)} bonusRates={bonusRates} onUpdateBonus={r=>{setBonusRates(r);localStorage.setItem("bonusRates",JSON.stringify(r));}} slotUnit={slotUnit} onUpdateSlotUnit={u=>setSlotUnit(u)} shopName={shopName} onUpdateShopName={n=>{setShopName(n);localStorage.setItem("shopName",n);}} onImportCustomers={saveCustomer} onImportBookings={addBooking} naverUrl={naverUrl} onUpdateNaverUrl={u=>{setNaverUrl(u);localStorage.setItem("naverUrl",u);}}/>}
      </div>

      {/* 하단 탭 */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:430,maxWidth:"100%",background:WH,borderTop:"1px solid "+G2,display:"flex",alignItems:"center",padding:"7px 0 18px",zIndex:99}}>
        {NAV_L.map(it => {
          const on=tab===it.id||(tab==="timetable"&&it.id==="home");
          return <button key={it.id} onClick={() => setTab(it.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"3px 0",color:on?P:G5}}>
            {it.ic}
            <span style={{fontSize:9,fontWeight:on?700:400,color:on?P:G5}}>{it.l}</span>
            {on&&<div style={{width:4,height:4,borderRadius:"50%",background:P}}/>}
          </button>;
        })}
        <div style={{flex:1,display:"flex",justifyContent:"center"}}>
          <button onClick={() => openModal(null,null)}
            style={{width:50,height:50,borderRadius:"50%",background:P,border:"none",color:WH,fontSize:24,boxShadow:"0 4px 14px "+P+"55",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",marginTop:-14}}>+</button>
        </div>
        {NAV_R.map(it => {
          const on=tab===it.id;
          return <button key={it.id} onClick={() => setTab(it.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",padding:"3px 0",color:on?P:G5}}>
            {it.ic}
            <span style={{fontSize:9,fontWeight:on?700:400,color:on?P:G5}}>{it.l}</span>
            {on&&<div style={{width:4,height:4,borderRadius:"50%",background:P}}/>}
          </button>;
        })}
      </div>

      {/* 사이드 메뉴 */}
      {menuOpen && (
        <>
          <div onClick={() => setMenu(false)} style={{position:"fixed",inset:0,background:"rgba(20,16,50,0.3)",zIndex:200}}/>
          <div style={{position:"fixed",top:0,left:0,width:255,height:"100vh",background:WH,zIndex:201,padding:"50px 0 36px",display:"flex",flexDirection:"column",boxShadow:"5px 0 28px "+P+"20"}}>
            <div style={{padding:"0 24px 18px",borderBottom:"1px solid "+G2}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <p style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:P,margin:0}}>{shopName}</p>
                <button onClick={() => setIsDark(d => !d)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center"}}>
                  {isDark
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DK} strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G5} strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  }
                </button>
              </div>
              <p style={{fontSize:10,color:G5,margin:"3px 0 0"}}>CRM v1.0</p>
            </div>
            <div style={{flex:1,padding:"6px 0",overflowY:"auto"}}>
              {menus.map(m => (
                <button key={m.l} onClick={m.a||undefined}
                  style={{width:"100%",padding:"11px 24px",background:"none",border:"none",textAlign:"left",fontSize:13,color:m.a?DK:G5,cursor:m.a?"pointer":"default",fontWeight:500,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  {m.l}{!m.a&&<span style={{fontSize:9,color:G3}}>준비중</span>}
                </button>
              ))}
              <div style={{margin:"7px 24px",height:1,background:G2}}/>
              <button onClick={() => {setTab("settings");setSettingsSub(null);setMenu(false);}}
                style={{width:"100%",padding:"11px 24px",background:"none",border:"none",textAlign:"left",fontSize:13,color:DK,cursor:"pointer",fontWeight:500}}>설정</button>
              <div style={{margin:"7px 24px",height:1,background:G2}}/>
              <button onClick={() => { setMenu(false); if(onLogout) onLogout(); }}
                style={{width:"100%",padding:"11px 24px",background:"none",border:"none",textAlign:"left",fontSize:13,color:RD,cursor:"pointer",fontWeight:600}}>로그아웃</button>
            </div>
          </div>
        </>
      )}

      {modal && <BookModal initTime={modal.time} initSid={modal.sid} initDate={modal.date} onClose={() => setModal(null)} staff={staff} onAddStaff={addStaff} slotUnit={slotUnit} onSave={addBooking} onSaveNewCust={saveCustomer}/>}

      {/* 선불권 잔액 문자 팝업 (결제 완료 직후) */}
      {payDone && (
        <div style={{position:"fixed",inset:0,zIndex:620,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:430,background:WH,borderRadius:"22px 22px 0 0",padding:"28px 20px 48px"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:PL,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{fontSize:16,fontWeight:800,color:DK}}>결제 완료!</div>
              <div style={{fontSize:13,color:G5,marginTop:6}}>{payDone.name}님 · 선불권 잔액 <span style={{color:P,fontWeight:700}}>{payDone.prepaidBal.toLocaleString()}원</span></div>
            </div>
            {payDone.phone ? (
              <>
                <textarea
                  defaultValue={`루미네일 (${payDone.name}님)\n${payDone.date} ${payDone.svc} ${payDone.amount.toLocaleString()}원 사용\n잔액 ${payDone.prepaidBal.toLocaleString()}원\n감사합니다. ♥`}
                  id="payDoneSmsText"
                  style={{width:"100%",minHeight:80,padding:"11px",borderRadius:11,border:"1.5px solid "+G2,fontSize:13,color:DK,background:BG,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.7,fontFamily:"inherit",marginBottom:10}}/>
                <a href={`sms:${payDone.phone.replace(/-/g,'')}`}
                  onClick={e=>{const el=document.getElementById('payDoneSmsText');const txt=el?el.value:`루미네일 (${payDone.name}님)\n${payDone.date} ${payDone.svc} ${payDone.amount.toLocaleString()}원 사용\n잔액 ${payDone.prepaidBal.toLocaleString()}원\n감사합니다. ♥`;e.currentTarget.href=`sms:${payDone.phone.replace(/-/g,'')}&body=${encodeURIComponent(txt)}`;setTimeout(()=>setPayDone(null),500);}}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"15px",borderRadius:14,background:P,color:WH,fontSize:14,fontWeight:700,marginBottom:10,textDecoration:"none"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={WH} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  문자 보내기
                </a>
              </>
            ) : null}
            <button onClick={() => setPayDone(null)} style={{width:"100%",padding:"14px",borderRadius:14,background:G2,border:"none",color:G7,fontSize:14,fontWeight:600,cursor:"pointer"}}>닫기</button>
          </div>
        </div>
      )}

      {/* 시술 기록 팝업 */}
      {showRecord && <TreatmentRecordModal bk={showRecord} onClose={() => setShowRecord(null)} onSave={saveRecord}/>}

      {/* 결제 팝업 */}
      {showPay && (
        <Sheet onClose={() => setShowPay(null)} maxH="92vh" zIndex={600}>
          <div style={{overflowY:"auto",flex:1,padding:"0 18px 44px"}}>
            <div style={{width:34,height:4,background:G3,borderRadius:2,margin:"12px auto 16px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:16,fontWeight:800,color:DK}}>결제 처리</span>
              <button onClick={() => setShowPay(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:G5}}>×</button>
            </div>

            {/* 시술 + 예약금 요약 */}
            <div style={{background:PS,borderRadius:13,padding:"12px 14px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showPay.depAmt>0?8:0}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:DK}}>{showPay.name}</div>
                  <div style={{fontSize:11,color:G5,marginTop:2}}>{showPay.svc}</div>
                </div>
                <div style={{fontSize:16,fontWeight:800,color:DK}}>{showPay.price.toLocaleString()}원</div>
              </div>
              {showPay.depAmt > 0 && (
                <div style={{borderTop:"1px solid "+G2,paddingTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,color:G5}}>예약금 납부</span>
                    <span style={{fontSize:11,fontWeight:600,color:GR}}>−{showPay.depAmt.toLocaleString()}원</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,fontWeight:700,color:DK}}>잔금</span>
                    <span style={{fontSize:13,fontWeight:800,color:P}}>{Math.max(0,showPay.price-showPay.depAmt).toLocaleString()}원</span>
                  </div>
                </div>
              )}
            </div>

            {/* 최종 시술 금액 */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:G5,fontWeight:700,marginBottom:6}}>
                최종 시술 금액
                <span style={{fontSize:10,fontWeight:400,marginLeft:6,color:G5}}>기본가 {showPay.price.toLocaleString()}원</span>
              </div>
              <div style={{display:"flex",alignItems:"center",padding:"11px 14px",borderRadius:12,border:"1.5px solid "+(finalAmt&&Number(finalAmt)!==showPay.price?P:G2),background:WH,gap:8}}>
                <input
                  value={finalAmt}
                  onChange={e => setFinalAmt(e.target.value)}
                  type="number"
                  placeholder={String(showPay.price)}
                  style={{flex:1,border:"none",background:"transparent",fontSize:20,fontWeight:800,color:DK,outline:"none"}}
                />
                <span style={{fontSize:14,color:G5}}>원</span>
              </div>
              {finalAmt && Number(finalAmt) !== showPay.price && (
                <div style={{fontSize:11,marginTop:5,fontWeight:600,color:Number(finalAmt)>showPay.price?RD:GR}}>
                  기본가 대비 {Number(finalAmt)>showPay.price?"+":""}{(Number(finalAmt)-showPay.price).toLocaleString()}원
                </div>
              )}
            </div>

            {/* ── 제품 추가 섹션 ── */}
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:11,color:G5,fontWeight:700}}>제품 추가 (선택)</span>
                <button onClick={() => setProductItems(p => [...p,{name:"",price:""}])}
                  style={{padding:"4px 10px",borderRadius:8,background:PL,border:"1px solid "+PM,color:P,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 제품 추가</button>
              </div>
              {productItems.map((item,i) => (
                <div key={i} style={{display:"flex",gap:7,marginBottom:7,alignItems:"center"}}>
                  <input value={item.name} onChange={e => setProductItems(p => p.map((x,j) => j===i?{...x,name:e.target.value}:x))}
                    placeholder="제품명"
                    style={{flex:2,padding:"9px 10px",borderRadius:9,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH}}/>
                  <input value={item.price} onChange={e => setProductItems(p => p.map((x,j) => j===i?{...x,price:e.target.value}:x))}
                    placeholder="금액" type="number"
                    style={{flex:1,padding:"9px 10px",borderRadius:9,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH}}/>
                  <button onClick={() => setProductItems(p => p.filter((_,j) => j!==i))}
                    style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 4px"}}>×</button>
                </div>
              ))}
              {/* 제품 합계 */}
              {productItems.length > 0 && (()=>{
                const prodTotal = productItems.reduce((s,x) => s+(Number(x.price)||0), 0);
                const effectivePrice = finalAmt ? Number(finalAmt) : showPay.price;
                const svcAmt = Math.max(0, effectivePrice - (showPay.depAmt||0));
                const grandTotal = svcAmt + prodTotal;
                return (
                  <div style={{borderRadius:11,border:"1px solid "+PM,overflow:"hidden",marginTop:4}}>
                    {prodTotal > 0 && (
                      <div style={{display:"flex",justifyContent:"space-between",padding:"9px 13px",background:WH,borderBottom:"1px solid "+G2}}>
                        <span style={{fontSize:12,color:G5}}>제품 합계</span>
                        <span style={{fontSize:12,fontWeight:600,color:DK}}>{prodTotal.toLocaleString()}원</span>
                      </div>
                    )}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 13px",background:PL}}>
                      <span style={{fontSize:13,fontWeight:700,color:DK}}>최종 결제금액</span>
                      <span style={{fontSize:17,fontWeight:800,color:P}}>{grandTotal.toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 결제수단 */}
            <div style={{fontSize:11,color:G5,fontWeight:600,marginBottom:8}}>결제수단</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              {(isDark ? [
                {v:"naverpay",   l:"N페이",     bg:"#0C2820", ac:"#5DD4BE", tx:"#A0EEE0"},
                {v:"card",       l:"카드",      bg:"#1A1040", ac:"#A87FFF", tx:"#C8AEFF"},
                {v:"cash",       l:"현금",      bg:"#2C1508", ac:"#FF9B6A", tx:"#FFBE98"},
                {v:"prepaid",    l:"선불권 사용", bg:ORL,       ac:OR,        tx:OR},
                {v:"prepaid_new",l:"선불권 충전", bg:"#092820", ac:"#2DE8B8", tx:"#72FFD8"},
                {v:"etc",        l:"기타",      bg:"#18142A", ac:"#8880D0", tx:"#B0ACEC"},
              ] : [
                {v:"naverpay",   l:"N페이",     bg:"#E5F8F1", ac:"#5DC4A2", tx:"#2D8A62"},
                {v:"card",       l:"카드",      bg:"#EEE8FB", ac:"#9B7EDF", tx:"#5933B5"},
                {v:"cash",       l:"현금",      bg:"#FFF0E8", ac:"#F4976C", tx:"#C0572A"},
                {v:"prepaid",    l:"선불권 사용", bg:ORL,       ac:OR,        tx:OR},
                {v:"prepaid_new",l:"선불권 충전", bg:"#E5F8F4", ac:"#5DC4B0", tx:"#2A8070"},
                {v:"etc",        l:"기타",      bg:"#F0EEF8", ac:"#9890C5", tx:"#504888"},
              ]).map(o => {
                const sel = splitMode
                  ? splitItems.some(x=>x.v===o.v)
                  : payMethod===o.v;
                const isPrep = o.v==='prepaid'||o.v==='prepaid_new';
                return (
                  <button key={o.v} onClick={() => {
                    if(splitMode) {
                      if(isPrep) return; // 복합결제에서 선불권 제외
                      if(!splitItems.some(x=>x.v===o.v))
                        setSplitItems(p=>[...p,{v:o.v,l:o.l,amount:""}]);
                    } else {
                      setPayMethod(o.v);
                    }
                  }}
                    style={{padding:"10px 4px",borderRadius:12,border:sel?"none":"1px solid "+G2,background:sel?o.ac:o.bg,color:sel?WH:(splitMode&&isPrep?G5:o.tx),fontSize:11,fontWeight:700,cursor:splitMode&&isPrep?"not-allowed":"pointer",textAlign:"center",lineHeight:1.4,boxShadow:sel?"0 3px 10px "+o.ac+"44":"none",opacity:splitMode&&isPrep?0.4:1}}>
                    {splitMode&&!isPrep&&!splitItems.some(x=>x.v===o.v)?"+ ":""}{o.l}
                  </button>
                );
              })}
            </div>

            {/* 복합결제 토글 */}
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
              <button onClick={()=>{
                if(splitMode){setSplitMode(false);setSplitItems([]);setPayMethod("");}
                else{
                  const simpleOpts=[{v:"naverpay",l:"N페이"},{v:"card",l:"카드"},{v:"cash",l:"현금"},{v:"transfer",l:"계좌이체"},{v:"etc",l:"기타"}];
                  const initItem=simpleOpts.find(o=>o.v===payMethod);
                  setSplitMode(true);
                  setSplitItems(initItem?[{...initItem,amount:""}]:[]);
                  setPayMethod("");
                }
              }} style={{fontSize:11,fontWeight:700,color:splitMode?RD:P,background:"none",border:"1px solid "+(splitMode?RD:PM),borderRadius:8,padding:"5px 11px",cursor:"pointer"}}>
                {splitMode?"단일결제로":"복합결제 +"}
              </button>
            </div>

            {/* 복합결제 내역 */}
            {splitMode && (()=>{
              const effPrice = finalAmt?Number(finalAmt):showPay.price;
              const prodTot = productItems.reduce((s,x)=>s+(Number(x.price)||0),0);
              const need = Math.max(0,effPrice-(showPay.depAmt||0))+prodTot;
              const got = splitItems.reduce((s,x)=>s+(Number(x.amount)||0),0);
              const diff = need-got;
              return (
                <div style={{marginBottom:14,borderRadius:13,border:"1.5px solid "+PM,overflow:"hidden"}}>
                  <div style={{background:PL,padding:"10px 14px",borderBottom:"1px solid "+G2}}>
                    <div style={{fontSize:11,fontWeight:700,color:P}}>복합결제 내역</div>
                  </div>
                  <div style={{padding:"10px 14px"}}>
                    {splitItems.map((item,i)=>(
                      <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:700,color:DK,width:60,flexShrink:0}}>{item.l}</span>
                        <input value={item.amount} onChange={e=>setSplitItems(p=>p.map((x,j)=>j===i?{...x,amount:e.target.value}:x))}
                          type="number" placeholder="금액"
                          style={{flex:1,padding:"8px 10px",borderRadius:9,border:"1.5px solid "+G2,fontSize:13,fontWeight:700,outline:"none",color:DK,background:WH}}/>
                        <span style={{fontSize:12,color:G5}}>원</span>
                        <button onClick={()=>setSplitItems(p=>p.filter((_,j)=>j!==i))}
                          style={{background:"none",border:"none",cursor:"pointer",color:G5,fontSize:18,padding:"0 4px",flexShrink:0}}>×</button>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:"1px solid "+G2,marginTop:4}}>
                      <span style={{fontSize:12,color:G5}}>합계 / 필요</span>
                      <span style={{fontSize:13,fontWeight:800,color:diff===0?GR:RD}}>
                        {got.toLocaleString()}원 / {need.toLocaleString()}원
                        {diff>0&&<span style={{fontSize:11,fontWeight:600}}> ({diff.toLocaleString()}원 부족)</span>}
                        {diff<0&&<span style={{fontSize:11,fontWeight:600}}> ({(-diff).toLocaleString()}원 초과)</span>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {!splitMode && payMethod==="etc" && (
              <div style={{marginBottom:12}}>
                <input value={payMemo} onChange={e => setPayMemo(e.target.value)} placeholder="결제 방법 메모 (예: 상품권)"
                  style={{width:"100%",padding:"11px 13px",borderRadius:11,border:"1.5px solid "+G2,fontSize:12,outline:"none",color:DK,background:WH,boxSizing:"border-box"}}/>
              </div>
            )}
            {!splitMode && payMethod==="prepaid" && (() => {
              const pe=PREPAID_DATA.find(d=>d.custName===showPay.name);
              const deduct=Math.max(0,(finalAmt?Number(finalAmt):showPay.price)-(showPay.depAmt||0));
              const afterBal=pe?pe.balance-deduct:null;
              return (
                <div style={{marginBottom:12,padding:"11px 13px",borderRadius:11,background:PL,fontSize:12,color:P,fontWeight:600}}>
                  {pe?<>잔액 {pe.balance.toLocaleString()}원 → {Math.max(0,afterBal).toLocaleString()}원 ({deduct.toLocaleString()}원 차감)</>
                     :<>선불권 잔액에서 {deduct.toLocaleString()}원 차감돼요</>}
                </div>
              );
            })()}
            {!splitMode && payMethod==="prepaid_new" && (
              <div style={{marginBottom:12,borderRadius:13,border:"1.5px solid #2E7D52",overflow:"hidden"}}>
                <div style={{background:"#2E7D52",padding:"8px 14px"}}>
                  <span style={{fontSize:11,fontWeight:700,color:WH}}>선불권 충전 + 당일 시술 결제</span>
                </div>
                <div style={{padding:"12px 14px",background:"#F8FFFB"}}>
                  <PrepaidChargeForm
                    amount={chargeAmt} setAmount={setChargeAmt}
                    chargeMethod={payMemo} setChargeMethod={setPayMemo}
                    bonusInput={payBonus} setBonusInput={setPayBonus}
                    memo={""} setMemo={()=>{}}
                    onConfirm={()=>{}} confirmLabel="" confirmActive={false}
                  />
                  {chargeAmt && Number(chargeAmt)>0 && (()=>{
                    const charge=Number(chargeAmt), bonus=Number(payBonus)||0;
                    const ep=finalAmt?Number(finalAmt):showPay.price;
                    const prodTot=productItems.reduce((s,x)=>s+(Number(x.price)||0),0);
                    // 실제 선불권에서 차감할 금액 = 잔금(예약금 제외) + 제품
                    const deduct=Math.max(0,ep-(showPay.depAmt||0))+prodTot;
                    const total=charge+bonus, remain=total-deduct;
                    return (
                      <div style={{marginTop:8,padding:"10px 13px",borderRadius:11,background:"#E8F9EF",border:"1px solid #2E7D52",fontSize:12,color:"#2E7D52"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span>충전금액</span><span style={{fontWeight:700}}>{charge.toLocaleString()}원</span>
                        </div>
                        {bonus>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>보너스</span><span style={{fontWeight:700,color:GR}}>+{bonus.toLocaleString()}원</span></div>}
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>당일 시술{(showPay.depAmt||0)>0?" (잔금)":""}</span><span style={{fontWeight:700,color:RD}}>−{deduct.toLocaleString()}원</span></div>
                        <div style={{height:1,background:"#2E7D5230",margin:"5px 0"}}/>
                        <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:13}}>
                          <span>잔여 선불권</span>
                          <span style={{color:remain<0?RD:"#2E7D52"}}>{remain.toLocaleString()}원</span>
                        </div>
                        {remain<0&&<div style={{marginTop:5,fontSize:11,color:RD,fontWeight:600}}>충전 금액이 부족해요 ({(-remain).toLocaleString()}원 더 필요)</div>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <button onClick={completePayment}
              style={{width:"100%",padding:"14px",borderRadius:14,background:(()=>{
                const ep2=finalAmt?Number(finalAmt):showPay.price;
                const prodTot2=productItems.reduce((s,x)=>s+(Number(x.price)||0),0);
                const need2=Math.max(0,ep2-(showPay.depAmt||0))+prodTot2;
                if(splitMode){
                  const got2=splitItems.reduce((s,x)=>s+(Number(x.amount)||0),0);
                  return got2===need2&&splitItems.length>0?P:G3;
                }
                if(!payMethod) return G3;
                if(payMethod==="prepaid_new"){
                  if(!chargeAmt) return G3;
                  return (Number(chargeAmt)+(Number(payBonus)||0))>=need2?P:G3;
                }
                return P;
              })(),border:"none",color:WH,fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {(()=>{
                const prodTotal=productItems.reduce((s,x)=>s+(Number(x.price)||0),0);
                const effectivePrice=finalAmt?Number(finalAmt):showPay.price;
                const svcAmt=Math.max(0,effectivePrice-(showPay.depAmt||0));
                const total=svcAmt+prodTotal;
                if(splitMode){
                  const got3=splitItems.reduce((s,x)=>s+(Number(x.amount)||0),0);
                  if(splitItems.length===0) return "결제수단을 추가하세요";
                  return got3===total?"결제 완료 · "+total.toLocaleString()+"원":"금액을 맞춰주세요 ("+got3.toLocaleString()+"원 / "+total.toLocaleString()+"원)";
                }
                if(!payMethod) return "결제수단을 선택하세요";
                if(payMethod==="prepaid_new"){
                  if(!chargeAmt) return "충전 금액을 입력하세요";
                  if((Number(chargeAmt)+(Number(payBonus)||0))<total) return "충전 금액이 부족해요";
                }
                return "결제 완료 · "+total.toLocaleString()+"원";
              })()}
            </button>
          </div>
        </Sheet>
      )}

      {/* ── 결제 취소 확인 인앱 모달 ── */}
      {confirmCancel && (
        <div style={{position:"fixed",inset:0,zIndex:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={() => setConfirmCancel(null)} style={{position:"absolute",inset:0,background:"rgba(20,16,50,0.5)"}}/>
          <div style={{position:"relative",background:WH,borderRadius:20,padding:"28px 24px",width:300,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:16,fontWeight:800,color:DK,marginBottom:8,textAlign:"center"}}>결제 취소</div>
            <div style={{fontSize:13,color:G7,marginBottom:22,textAlign:"center",lineHeight:1.6}}>
              <span style={{fontWeight:700,color:P}}>{confirmCancel.name}</span>님의<br/>결제를 취소하시겠어요?
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={() => setConfirmCancel(null)}
                style={{flex:1,padding:"12px",borderRadius:12,background:G2,border:"none",color:G7,fontSize:13,fontWeight:600,cursor:"pointer"}}>아니요</button>
              <button onClick={() => cancelPayment(confirmCancel.id)}
                style={{flex:1,padding:"12px",borderRadius:12,background:RD,border:"none",color:WH,fontSize:13,fontWeight:700,cursor:"pointer"}}>취소 확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}









