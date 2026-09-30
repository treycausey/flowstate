import { PHASE_START } from './environment'

/**
 * Inline pre-paint script: sets data-tank-phase from the local clock so a night load never
 * paints day tokens first. The boundaries come from PHASE_START, the same constants `phaseAt`
 * uses; tests/tank/phaseScript.test.ts checks the two agree for every 15 minutes of the day.
 */
export const PHASE_SCRIPT = `try{var d=new Date(),h=d.getHours()+d.getMinutes()/60+d.getSeconds()/3600,S=${JSON.stringify(PHASE_START)};document.documentElement.setAttribute('data-tank-phase',h>=S.dawn&&h<S.day?'dawn':h>=S.day&&h<S.dusk?'day':h>=S.dusk&&h<S.night?'dusk':'night')}catch(e){}`
