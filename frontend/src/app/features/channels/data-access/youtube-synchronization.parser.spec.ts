import { parseYouTubeSynchronization } from './youtube-synchronization.parser';
describe('YouTube synchronization parser',()=>{
  it('accepts an explicitly simulated completed collection',()=>{const value=parseYouTubeSynchronization(response());expect(value?.source).toBe('SIMULATED');expect(value?.simulated).toBe(true);expect(value?.videoCount).toBe(3);});
  it('rejects simulated data without the matching source',()=>{expect(()=>parseYouTubeSynchronization({...response(),source:'YOUTUBE'})).toThrow();});
  it('allows the absence of a previous synchronization',()=>expect(parseYouTubeSynchronization(null)).toBeNull());
});
function response(){return{id:'00000000-0000-4000-8000-000000000001',status:'COMPLETED',stage:'FINISHED',source:'SIMULATED',simulated:true,coverage:'LAST_28_DAYS',limitations:null,failureCode:null,startedAt:'2026-07-28T12:00:00Z',collectedAt:'2026-07-28T12:01:00Z',completedAt:'2026-07-28T12:01:01Z',videoCount:3};}
