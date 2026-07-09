import type { BudgetBreakdown, TravelerProfile, Trip } from '../types';

const FUEL_PRICE_PER_GALLON = 3.6;

const LODGING_RATES: Record<TravelerProfile['budgetLevel'], Record<TravelerProfile['lodgingPreference'], number>> = {
  budget: { hotels: 95, motels: 75, camping: 35, mix: 80 },
  moderate: { hotels: 160, motels: 110, camping: 45, mix: 140 },
  luxury: { hotels: 320, motels: 180, camping: 80, mix: 280 },
};

const FOOD_PER_PERSON: Record<TravelerProfile['budgetLevel'], number> = {
  budget: 35,
  moderate: 65,
  luxury: 120,
};

const ACTIVITY_PER_DAY: Record<TravelerProfile['budgetLevel'], number> = {
  budget: 20,
  moderate: 45,
  luxury: 90,
};

export function estimateBudget(
  trip: Trip,
  profile: TravelerProfile,
  mpg: number | null,
): BudgetBreakdown {
  const effectiveMpg =
    mpg && mpg > 0 ? mpg : profile.vehicle?.mpg && profile.vehicle.mpg > 0 ? profile.vehicle.mpg : 28;
  const totalMiles = trip.legs.reduce((sum, l) => sum + l.distanceMeters, 0) / 1609.344;
  const isEv =
    profile.vehicle?.fuelType === 'electric' || profile.vehicle?.fuelType === 'plugin_hybrid';
  // Rough: EV uses MPGe with ~$0.16/kWh ≈ $3.6/gal equivalent scaled; keep simple $/gal proxy for MPGe
  const energyPrice = isEv ? 3.2 : FUEL_PRICE_PER_GALLON;
  const fuel = (totalMiles / effectiveMpg) * energyPrice;

  const lodgingNights = Math.max(0, (trip.days.length || trip.totalDays) - (trip.roundTrip ? 0 : 0));
  // Charge lodging for each night away: typically days-1 for one-way ending at dest, days for multi-day with overnight each night except maybe last if home
  const nights = Math.max(
    0,
    trip.stops.filter((s) => s.category === 'lodging').length ||
      Math.max(0, (trip.days.length || trip.totalDays) - (trip.roundTrip ? 0 : 1)),
  );
  const lodgingRate = LODGING_RATES[profile.budgetLevel][profile.lodgingPreference];
  const lodgingFromStops = trip.stops
    .filter((s) => s.category === 'lodging')
    .reduce((sum, s) => sum + (s.costEstimate || lodgingRate), 0);
  const lodging = lodgingFromStops || nights * lodgingRate;

  const travelers = trip.travelers || 2;
  const foodFromStops = trip.stops
    .filter((s) => s.category === 'food')
    .reduce((sum, s) => sum + (s.costEstimate || 0), 0);
  const dayCount = Math.max(1, trip.days.length || trip.totalDays || 1);
  const food =
    foodFromStops || FOOD_PER_PERSON[profile.budgetLevel] * travelers * dayCount;

  const activityFromStops = trip.stops
    .filter((s) => s.category === 'attraction' || s.category === 'scenic')
    .reduce((sum, s) => sum + (s.costEstimate || 0), 0);
  const activities = activityFromStops || ACTIVITY_PER_DAY[profile.budgetLevel] * dayCount;

  const perDay = (trip.days.length ? trip.days : [{ index: 0 }]).map((day) => {
    const dayStops = trip.stops.filter((s) => s.dayIndex === day.index);
    const dayLegs = trip.legs.filter((l) => l.dayIndex === day.index);
    const dayMiles = dayLegs.reduce((sum, l) => sum + l.distanceMeters, 0) / 1609.344;
    const dayFuel = (dayMiles / effectiveMpg) * energyPrice;
    const dayLodging = dayStops
      .filter((s) => s.category === 'lodging')
      .reduce((sum, s) => sum + (s.costEstimate || lodgingRate), 0);
    const dayFood =
      dayStops.filter((s) => s.category === 'food').reduce((sum, s) => sum + (s.costEstimate || 0), 0) ||
      FOOD_PER_PERSON[profile.budgetLevel] * travelers;
    const dayActivities =
      dayStops
        .filter((s) => s.category === 'attraction' || s.category === 'scenic')
        .reduce((sum, s) => sum + (s.costEstimate || 0), 0) || ACTIVITY_PER_DAY[profile.budgetLevel];
    return {
      dayIndex: day.index,
      fuel: dayFuel,
      lodging: dayLodging,
      food: dayFood,
      activities: dayActivities,
      total: dayFuel + dayLodging + dayFood + dayActivities,
    };
  });

  const total = fuel + lodging + food + activities;
  void lodgingNights;

  return {
    fuel,
    lodging,
    food,
    activities,
    total,
    perDay,
    notes: isEv
      ? `Assumes ${effectiveMpg} MPGe · EV energy proxy`
      : `Assumes ${effectiveMpg} mpg at $${energyPrice.toFixed(2)}/gal${profile.vehicle ? ` · ${profile.vehicle.brandName} ${profile.vehicle.modelName}` : ''}`,
  };
}
