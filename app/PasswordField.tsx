'use client';

import {useState} from 'react';

function EyeIcon({crossed}:{crossed:boolean}){
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M2.2 12S6 5.5 12 5.5 21.8 12 21.8 12 18 18.5 12 18.5 2.2 12 2.2 12Z"/>
    <circle cx="12" cy="12" r="3.1"/>
    {crossed&&<path d="M4 20 20 4"/>}
  </svg>;
}

type Props={
  label:string;
  value:string;
  onChange:(value:string)=>void;
  autoComplete:'current-password'|'new-password';
  required?:boolean;
};

export default function PasswordField({label,value,onChange,autoComplete,required}:Props){
  const [visible,setVisible]=useState(false);
  const action=visible?'Passwort verbergen':'Passwort anzeigen';
  return <label>{label}
    <span className="password-input">
      <input required={required} type={visible?'text':'password'} autoComplete={autoComplete} value={value} onChange={event=>onChange(event.target.value)}/>
      <button type="button" className="password-reveal" onClick={()=>setVisible(!visible)} aria-pressed={visible} aria-label={action} title={action}><EyeIcon crossed={visible}/></button>
    </span>
  </label>;
}
