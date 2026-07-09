export type FuelType = 'gas' | 'diesel' | 'electric' | 'hybrid' | 'plugin_hybrid';

export interface VehicleModel {
  id: string;
  name: string;
  fuel: FuelType;
  mpg?: number; // combined or MPGe for EV
  rangeMiles?: number;
  drivetrain?: string;
}

export interface VehicleBrand {
  id: string;
  name: string;
  models: VehicleModel[];
}

export const VEHICLE_BRANDS: VehicleBrand[] = [
  {
    id: 'tesla',
    name: 'Tesla',
    models: [
      { id: 'model-3-rwd', name: 'Model 3 Rear-Wheel Drive', fuel: 'electric', mpg: 132, rangeMiles: 272, drivetrain: 'RWD' },
      { id: 'model-3-long-range', name: 'Model 3 Long Range AWD', fuel: 'electric', mpg: 131, rangeMiles: 341, drivetrain: 'AWD' },
      { id: 'model-3-performance', name: 'Model 3 Performance', fuel: 'electric', mpg: 112, rangeMiles: 303, drivetrain: 'AWD' },
      { id: 'model-y-rwd', name: 'Model Y Rear-Wheel Drive', fuel: 'electric', mpg: 122, rangeMiles: 260, drivetrain: 'RWD' },
      { id: 'model-y-long-range', name: 'Model Y Long Range AWD', fuel: 'electric', mpg: 122, rangeMiles: 320, drivetrain: 'AWD' },
      { id: 'model-y-performance', name: 'Model Y Performance', fuel: 'electric', mpg: 104, rangeMiles: 285, drivetrain: 'AWD' },
      { id: 'model-s', name: 'Model S', fuel: 'electric', mpg: 120, rangeMiles: 405, drivetrain: 'AWD' },
      { id: 'model-s-plaid', name: 'Model S Plaid', fuel: 'electric', mpg: 110, rangeMiles: 359, drivetrain: 'AWD' },
      { id: 'model-x', name: 'Model X', fuel: 'electric', mpg: 102, rangeMiles: 348, drivetrain: 'AWD' },
      { id: 'model-x-plaid', name: 'Model X Plaid', fuel: 'electric', mpg: 98, rangeMiles: 333, drivetrain: 'AWD' },
      { id: 'cybertruck-rwd', name: 'Cybertruck Rear-Wheel Drive', fuel: 'electric', mpg: 93, rangeMiles: 250, drivetrain: 'RWD' },
      { id: 'cybertruck-awd', name: 'Cybertruck AWD', fuel: 'electric', mpg: 93, rangeMiles: 340, drivetrain: 'AWD' },
      { id: 'cybertruck-cyberbeast', name: 'Cybertruck Cyberbeast', fuel: 'electric', mpg: 79, rangeMiles: 320, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'ford',
    name: 'Ford',
    models: [
      { id: 'f150', name: 'F-150', fuel: 'gas', mpg: 20, drivetrain: '4WD' },
      { id: 'f150-lightning', name: 'F-150 Lightning', fuel: 'electric', mpg: 70, rangeMiles: 320, drivetrain: 'AWD' },
      { id: 'mustang', name: 'Mustang GT', fuel: 'gas', mpg: 18, drivetrain: 'RWD' },
      { id: 'mustang-mach-e', name: 'Mustang Mach-E', fuel: 'electric', mpg: 97, rangeMiles: 310, drivetrain: 'AWD' },
      { id: 'bronco', name: 'Bronco', fuel: 'gas', mpg: 18, drivetrain: '4WD' },
      { id: 'explorer', name: 'Explorer', fuel: 'gas', mpg: 24, drivetrain: 'AWD' },
      { id: 'escape-hybrid', name: 'Escape Hybrid', fuel: 'hybrid', mpg: 41, drivetrain: 'FWD' },
      { id: 'maverick-hybrid', name: 'Maverick Hybrid', fuel: 'hybrid', mpg: 37, drivetrain: 'FWD' },
    ],
  },
  {
    id: 'gmc',
    name: 'GMC',
    models: [
      { id: 'sierra-1500', name: 'Sierra 1500', fuel: 'gas', mpg: 19, drivetrain: '4WD' },
      { id: 'sierra-ev', name: 'Sierra EV Denali', fuel: 'electric', mpg: 59, rangeMiles: 460, drivetrain: 'AWD' },
      { id: 'yukon', name: 'Yukon', fuel: 'gas', mpg: 17, drivetrain: '4WD' },
      { id: 'terrain', name: 'Terrain', fuel: 'gas', mpg: 26, drivetrain: 'AWD' },
      { id: 'hummer-ev', name: 'HUMMER EV', fuel: 'electric', mpg: 47, rangeMiles: 300, drivetrain: 'AWD' },
      { id: 'canyon', name: 'Canyon', fuel: 'gas', mpg: 20, drivetrain: '4WD' },
    ],
  },
  {
    id: 'chevrolet',
    name: 'Chevrolet',
    models: [
      { id: 'silverado', name: 'Silverado 1500', fuel: 'gas', mpg: 20, drivetrain: '4WD' },
      { id: 'silverado-ev', name: 'Silverado EV', fuel: 'electric', mpg: 61, rangeMiles: 450, drivetrain: 'AWD' },
      { id: 'equinox', name: 'Equinox', fuel: 'gas', mpg: 28, drivetrain: 'AWD' },
      { id: 'equinox-ev', name: 'Equinox EV', fuel: 'electric', mpg: 117, rangeMiles: 319, drivetrain: 'FWD' },
      { id: 'tahoe', name: 'Tahoe', fuel: 'gas', mpg: 17, drivetrain: '4WD' },
      { id: 'corvette', name: 'Corvette Stingray', fuel: 'gas', mpg: 19, drivetrain: 'RWD' },
      { id: 'bolt-euv', name: 'Bolt EUV', fuel: 'electric', mpg: 115, rangeMiles: 247, drivetrain: 'FWD' },
    ],
  },
  {
    id: 'toyota',
    name: 'Toyota',
    models: [
      { id: 'camry', name: 'Camry', fuel: 'gas', mpg: 32, drivetrain: 'FWD' },
      { id: 'camry-hybrid', name: 'Camry Hybrid', fuel: 'hybrid', mpg: 52, drivetrain: 'FWD' },
      { id: 'corolla', name: 'Corolla', fuel: 'gas', mpg: 35, drivetrain: 'FWD' },
      { id: 'rav4', name: 'RAV4', fuel: 'gas', mpg: 30, drivetrain: 'AWD' },
      { id: 'rav4-hybrid', name: 'RAV4 Hybrid', fuel: 'hybrid', mpg: 40, drivetrain: 'AWD' },
      { id: 'rav4-prime', name: 'RAV4 Prime', fuel: 'plugin_hybrid', mpg: 94, rangeMiles: 42, drivetrain: 'AWD' },
      { id: 'highlander', name: 'Highlander', fuel: 'gas', mpg: 24, drivetrain: 'AWD' },
      { id: '4runner', name: '4Runner', fuel: 'gas', mpg: 17, drivetrain: '4WD' },
      { id: 'tacoma', name: 'Tacoma', fuel: 'gas', mpg: 21, drivetrain: '4WD' },
      { id: 'tundra', name: 'Tundra', fuel: 'gas', mpg: 20, drivetrain: '4WD' },
      { id: 'prius', name: 'Prius', fuel: 'hybrid', mpg: 57, drivetrain: 'FWD' },
      { id: 'bz4x', name: 'bZ4X', fuel: 'electric', mpg: 112, rangeMiles: 252, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'honda',
    name: 'Honda',
    models: [
      { id: 'civic', name: 'Civic', fuel: 'gas', mpg: 36, drivetrain: 'FWD' },
      { id: 'accord', name: 'Accord', fuel: 'gas', mpg: 32, drivetrain: 'FWD' },
      { id: 'accord-hybrid', name: 'Accord Hybrid', fuel: 'hybrid', mpg: 48, drivetrain: 'FWD' },
      { id: 'crv', name: 'CR-V', fuel: 'gas', mpg: 30, drivetrain: 'AWD' },
      { id: 'crv-hybrid', name: 'CR-V Hybrid', fuel: 'hybrid', mpg: 37, drivetrain: 'AWD' },
      { id: 'pilot', name: 'Pilot', fuel: 'gas', mpg: 22, drivetrain: 'AWD' },
      { id: 'prologue', name: 'Prologue', fuel: 'electric', mpg: 101, rangeMiles: 296, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'jeep',
    name: 'Jeep',
    models: [
      { id: 'wrangler', name: 'Wrangler', fuel: 'gas', mpg: 20, drivetrain: '4WD' },
      { id: 'wrangler-4xe', name: 'Wrangler 4xe', fuel: 'plugin_hybrid', mpg: 49, rangeMiles: 21, drivetrain: '4WD' },
      { id: 'grand-cherokee', name: 'Grand Cherokee', fuel: 'gas', mpg: 22, drivetrain: '4WD' },
      { id: 'gladiator', name: 'Gladiator', fuel: 'gas', mpg: 19, drivetrain: '4WD' },
      { id: 'wagoneer', name: 'Wagoneer', fuel: 'gas', mpg: 18, drivetrain: '4WD' },
    ],
  },
  {
    id: 'bmw',
    name: 'BMW',
    models: [
      { id: '3-series', name: '3 Series', fuel: 'gas', mpg: 30, drivetrain: 'RWD' },
      { id: 'x3', name: 'X3', fuel: 'gas', mpg: 25, drivetrain: 'AWD' },
      { id: 'x5', name: 'X5', fuel: 'gas', mpg: 23, drivetrain: 'AWD' },
      { id: 'i4', name: 'i4 eDrive40', fuel: 'electric', mpg: 109, rangeMiles: 301, drivetrain: 'RWD' },
      { id: 'ix', name: 'iX xDrive50', fuel: 'electric', mpg: 86, rangeMiles: 324, drivetrain: 'AWD' },
      { id: 'i7', name: 'i7', fuel: 'electric', mpg: 87, rangeMiles: 296, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'mercedes',
    name: 'Mercedes-Benz',
    models: [
      { id: 'c-class', name: 'C-Class', fuel: 'gas', mpg: 28, drivetrain: 'RWD' },
      { id: 'gle', name: 'GLE', fuel: 'gas', mpg: 22, drivetrain: 'AWD' },
      { id: 'eqs', name: 'EQS 450+', fuel: 'electric', mpg: 97, rangeMiles: 350, drivetrain: 'RWD' },
      { id: 'eqe', name: 'EQE', fuel: 'electric', mpg: 98, rangeMiles: 305, drivetrain: 'RWD' },
      { id: 'g-wagon', name: 'G-Class', fuel: 'gas', mpg: 14, drivetrain: '4WD' },
    ],
  },
  {
    id: 'rivian',
    name: 'Rivian',
    models: [
      { id: 'r1t-dual', name: 'R1T Dual Motor', fuel: 'electric', mpg: 70, rangeMiles: 410, drivetrain: 'AWD' },
      { id: 'r1t-tri', name: 'R1T Tri Motor', fuel: 'electric', mpg: 65, rangeMiles: 352, drivetrain: 'AWD' },
      { id: 'r1s-dual', name: 'R1S Dual Motor', fuel: 'electric', mpg: 69, rangeMiles: 410, drivetrain: 'AWD' },
      { id: 'r1s-tri', name: 'R1S Tri Motor', fuel: 'electric', mpg: 63, rangeMiles: 352, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'hyundai',
    name: 'Hyundai',
    models: [
      { id: 'tucson', name: 'Tucson', fuel: 'gas', mpg: 28, drivetrain: 'AWD' },
      { id: 'santa-fe', name: 'Santa Fe', fuel: 'gas', mpg: 25, drivetrain: 'AWD' },
      { id: 'ioniq-5', name: 'Ioniq 5', fuel: 'electric', mpg: 110, rangeMiles: 303, drivetrain: 'AWD' },
      { id: 'ioniq-6', name: 'Ioniq 6', fuel: 'electric', mpg: 125, rangeMiles: 361, drivetrain: 'RWD' },
      { id: 'palisade', name: 'Palisade', fuel: 'gas', mpg: 22, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'kia',
    name: 'Kia',
    models: [
      { id: 'sportage', name: 'Sportage', fuel: 'gas', mpg: 28, drivetrain: 'AWD' },
      { id: 'telluride', name: 'Telluride', fuel: 'gas', mpg: 23, drivetrain: 'AWD' },
      { id: 'ev6', name: 'EV6', fuel: 'electric', mpg: 117, rangeMiles: 310, drivetrain: 'AWD' },
      { id: 'ev9', name: 'EV9', fuel: 'electric', mpg: 91, rangeMiles: 304, drivetrain: 'AWD' },
      { id: 'carnival', name: 'Carnival', fuel: 'gas', mpg: 22, drivetrain: 'FWD' },
    ],
  },
  {
    id: 'subaru',
    name: 'Subaru',
    models: [
      { id: 'outback', name: 'Outback', fuel: 'gas', mpg: 29, drivetrain: 'AWD' },
      { id: 'forester', name: 'Forester', fuel: 'gas', mpg: 29, drivetrain: 'AWD' },
      { id: 'crosstrek', name: 'Crosstrek', fuel: 'gas', mpg: 30, drivetrain: 'AWD' },
      { id: 'ascent', name: 'Ascent', fuel: 'gas', mpg: 23, drivetrain: 'AWD' },
      { id: 'solterra', name: 'Solterra', fuel: 'electric', mpg: 104, rangeMiles: 228, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'ram',
    name: 'Ram',
    models: [
      { id: '1500', name: '1500', fuel: 'gas', mpg: 22, drivetrain: '4WD' },
      { id: '1500-diesel', name: '1500 EcoDiesel', fuel: 'diesel', mpg: 26, drivetrain: '4WD' },
      { id: '2500', name: '2500', fuel: 'diesel', mpg: 18, drivetrain: '4WD' },
    ],
  },
  {
    id: 'nissan',
    name: 'Nissan',
    models: [
      { id: 'rogue', name: 'Rogue', fuel: 'gas', mpg: 33, drivetrain: 'AWD' },
      { id: 'pathfinder', name: 'Pathfinder', fuel: 'gas', mpg: 24, drivetrain: 'AWD' },
      { id: 'frontier', name: 'Frontier', fuel: 'gas', mpg: 21, drivetrain: '4WD' },
      { id: 'ariya', name: 'Ariya', fuel: 'electric', mpg: 101, rangeMiles: 289, drivetrain: 'AWD' },
      { id: 'leaf', name: 'LEAF', fuel: 'electric', mpg: 111, rangeMiles: 212, drivetrain: 'FWD' },
    ],
  },
  {
    id: 'volkswagen',
    name: 'Volkswagen',
    models: [
      { id: 'tiguan', name: 'Tiguan', fuel: 'gas', mpg: 26, drivetrain: 'AWD' },
      { id: 'atlas', name: 'Atlas', fuel: 'gas', mpg: 21, drivetrain: 'AWD' },
      { id: 'id4', name: 'ID.4', fuel: 'electric', mpg: 107, rangeMiles: 275, drivetrain: 'AWD' },
      { id: 'jetta', name: 'Jetta', fuel: 'gas', mpg: 34, drivetrain: 'FWD' },
    ],
  },
  {
    id: 'audi',
    name: 'Audi',
    models: [
      { id: 'q5', name: 'Q5', fuel: 'gas', mpg: 25, drivetrain: 'AWD' },
      { id: 'q7', name: 'Q7', fuel: 'gas', mpg: 21, drivetrain: 'AWD' },
      { id: 'e-tron-gt', name: 'e-tron GT', fuel: 'electric', mpg: 85, rangeMiles: 249, drivetrain: 'AWD' },
      { id: 'q4-etron', name: 'Q4 e-tron', fuel: 'electric', mpg: 100, rangeMiles: 265, drivetrain: 'AWD' },
      { id: 'a4', name: 'A4', fuel: 'gas', mpg: 30, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'porsche',
    name: 'Porsche',
    models: [
      { id: '911', name: '911 Carrera', fuel: 'gas', mpg: 21, drivetrain: 'RWD' },
      { id: 'cayenne', name: 'Cayenne', fuel: 'gas', mpg: 20, drivetrain: 'AWD' },
      { id: 'macan', name: 'Macan', fuel: 'gas', mpg: 21, drivetrain: 'AWD' },
      { id: 'taycan', name: 'Taycan', fuel: 'electric', mpg: 83, rangeMiles: 246, drivetrain: 'AWD' },
      { id: 'macan-electric', name: 'Macan Electric', fuel: 'electric', mpg: 95, rangeMiles: 308, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'mazda',
    name: 'Mazda',
    models: [
      { id: 'cx5', name: 'CX-5', fuel: 'gas', mpg: 27, drivetrain: 'AWD' },
      { id: 'cx50', name: 'CX-50', fuel: 'gas', mpg: 26, drivetrain: 'AWD' },
      { id: 'cx90', name: 'CX-90', fuel: 'gas', mpg: 24, drivetrain: 'AWD' },
      { id: 'mazda3', name: 'Mazda3', fuel: 'gas', mpg: 31, drivetrain: 'AWD' },
    ],
  },
  {
    id: 'lucid',
    name: 'Lucid',
    models: [
      { id: 'air-pure', name: 'Air Pure', fuel: 'electric', mpg: 131, rangeMiles: 420, drivetrain: 'RWD' },
      { id: 'air-touring', name: 'Air Touring', fuel: 'electric', mpg: 121, rangeMiles: 406, drivetrain: 'AWD' },
      { id: 'air-grand-touring', name: 'Air Grand Touring', fuel: 'electric', mpg: 117, rangeMiles: 516, drivetrain: 'AWD' },
      { id: 'gravity', name: 'Gravity', fuel: 'electric', mpg: 100, rangeMiles: 450, drivetrain: 'AWD' },
    ],
  },
];

export function findBrand(brandId: string) {
  return VEHICLE_BRANDS.find((b) => b.id === brandId);
}

export function findModel(brandId: string, modelId: string) {
  return findBrand(brandId)?.models.find((m) => m.id === modelId);
}

export const FUEL_LABELS: Record<FuelType, string> = {
  gas: 'Gas',
  diesel: 'Diesel',
  electric: 'Electric',
  hybrid: 'Hybrid',
  plugin_hybrid: 'Plug-in Hybrid',
};
