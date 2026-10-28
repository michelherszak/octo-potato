'use client';

export default function AnalyticsSettings(){
  return <button type="button" className="analytics-settings-button" onClick={()=>{
    localStorage.removeItem('techthese-analytics-consent');
    localStorage.removeItem('techthese-visitor-id');
    sessionStorage.removeItem('techthese-last-pageview');
    window.location.reload();
  }}>Einwilligung neu festlegen</button>;
}
