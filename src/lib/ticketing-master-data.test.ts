import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  DEPARTMENTS,
  REPORTING_ASSOCIATES,
  STUDIO_AREAS,
  STUDIOS,
  TRAINERS,
  getStudioAreaOptions,
} from './ticketing-data';

describe('Physique 57 master data constants', () => {
  it('uses the requested canonical studio options', () => {
    expect(STUDIOS).toEqual([
      'Kwality House, Kemps Corner',
      'Supreme HQ, Bandra',
      'Kenkere House, Bengaluru',
      'Courtside, Mumbai',
      'the Studio by Copper & Cloves, Bengaluru',
    ]);
  });

  it('uses the requested instructor option list', () => {
    expect(TRAINERS).toEqual([
      'Anisha Shah',
      'Anmol Sharma',
      'Atulan Purohit',
      'Bret Saldanha',
      'Cauveri Vikrant',
      'Chaitanya Nahar',
      'Janhavi Jain',
      'Kabir Varma',
      'Kajol Kanchan',
      'Karan Bhatia',
      'Karanvir Bhatia',
      'Mrigakshi Jaiswal',
      'Nishanth Raj',
      'Poojitha Bhaskar',
      'Pranjali Jain',
      'Pushyank Nahar',
      'Raunak Khemuka',
      'Reshma Sharma',
      "Richard D'Costa",
      'Rohan Dahima',
      'Saniya Jaiswal',
      'Shruti Kulkarni',
      'Shruti Suresh',
      'Siddhartha Kusuma',
      'Simonelle De Vitre',
      'Simran Dutt',
      'Upasna Paranjpe',
      'Veena Narasimhan',
      'Vivaran Dhasmana',
    ]);
  });

  it('uses the requested associate names for documented-by options', () => {
    expect(REPORTING_ASSOCIATES).toEqual([
      'Akshay Rane',
      'Zaheer Agarbattiwala',
      'Zahur Shaikh',
      'Tahira Sayyed',
      'Imran Shaikh',
      'Deesha Changwani',
      'Admin Admin',
      'Nadiya Shaikh',
      'Shipra Bhika',
      'Manisha Rathod',
      'Sheetal Kataria',
      'Priyanka Abnave',
      'Prathap Kp',
      'Api Serou',
      'Pavanthika',
      'Santhosh Kumar',
    ]);
  });

  it('uses the requested department names', () => {
    expect(DEPARTMENTS).toEqual([
      'Management',
      'Marketing & PR',
      'Sales & Client Servicing',
      'Training & Client Experience',
      'Operations & Maintenance',
      'Accounts & Finance',
      'Technical Support',
    ]);
  });

  it('derives studio-area options from the selected studio', () => {
    expect(STUDIO_AREAS['Kwality House, Kemps Corner']).toContain('Strength Studio');
    expect(STUDIO_AREAS['Kwality House, Kemps Corner']).toContain('powerCycle studio');
    expect(STUDIO_AREAS['Supreme HQ, Bandra']).toContain('studio - 2 or powerCycle Studio');
    expect(STUDIO_AREAS['Kenkere House, Bengaluru']).toEqual(expect.arrayContaining([
      'studio 1',
      'studio 2',
      'his space',
      'her space',
      'guest washroom',
    ]));
    expect(STUDIO_AREAS['Kenkere House, Bengaluru']).not.toContain('Strength Studio');
    expect(STUDIO_AREAS['Kenkere House, Bengaluru']).not.toContain('powerCycle studio');
    expect(getStudioAreaOptions('the Studio by Copper & Cloves, Bengaluru')).toEqual(STUDIO_AREAS['Kenkere House, Bengaluru']);
  });

  it('keeps issue labels descriptive instead of encoding repair status', () => {
    expect(CATEGORIES['Repair and Maintenance']).toContain('Broken Equipment');
    expect(CATEGORIES['Repair and Maintenance']).not.toContain('Broken Equipment Not Repaired');
    expect(CATEGORIES['Repair and Maintenance'].join(' ')).not.toMatch(/\bnot repaired\b/i);
  });
});
