const TRAINER_IMAGE_BASE = '/images/';

const TRAINER_IMAGE_FILES: Record<string, string> = {
  'Anisha Shah': '001-1_Anisha-1-e1590837044475.jpg',
  'Anmol Sharma': 'Anmol.jpeg',
  'Atulan Purohit': '002-Atulan-Image-1.jpg',
  'Bret Saldanha': 'Bret.jpeg',
  'Cauveri Vikrant': '003-Cauveri-1.jpg',
  'Chaitanya Nahar': 'Chaitanya.jpg',
  'Janhavi Jain': 'Janhavi.jpg',
  'Kabir Varma': 'Kabir.jpg',
  'Kajol Kanchan': '004-Kajol-Kanchan-1.jpg',
  'Karan Bhatia': '005-Karan-Bhatia-1-1.jpeg',
  'Karanvir Bhatia': 'Karanvir.jpg',
  'Mrigakshi Jaiswal': '007-Mrigakshi-Image-2.jpg',
  'Nishanth Raj': 'Nishanth.jpg',
  'Pranjali Jain': '008-Pranjali-Image-1.jpg',
  'Pushyank Nahar': '009-Pushyank-Nahar-1.jpeg',
  'Raunak Khemuka': 'Raunak.jpeg',
  'Reshma Sharma': '010-Reshma-Image-3.jpg',
  "Richard D'Costa": '011-Richard-Image-3.jpg',
  'Rohan Dahima': '012-Rohan-Image-3.jpg',
  'Saniya Jaiswal': '013-Saniya-Image-1.jpg',
  'Shruti Kulkarni': '014-Shruti-Kulkarni.jpeg',
  'Siddhartha Kusuma': 'Siddhartha.jpg',
  'Simonelle De Vitre': 'Simonelle.jpeg',
  'Simran Dutt': 'Simran.jpeg',
  'Upasna Paranjpe': 'Upasana.jpg',
  'Veena Narasimhan': 'Veena.jpeg',
  'Vivaran Dhasmana': '015-Vivaran-Image-4.jpg',
};

export function trainerImageUrl(name?: string | null): string | undefined {
  if (!name) return undefined;
  const file = TRAINER_IMAGE_FILES[name];
  return file ? `${TRAINER_IMAGE_BASE}${file}` : undefined;
}

export function trainerInitials(name?: string | null): string {
  if (!name) return 'P57';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'P') + (parts[1]?.[0] || parts[0]?.[1] || '57');
}
