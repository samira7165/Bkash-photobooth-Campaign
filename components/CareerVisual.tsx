import Image from 'next/image';

const CAREER_IMAGES: Record<string, string> = {
  Military: '/careers/military.png',
  Painter: '/careers/painter.png',
  Scientist: '/careers/scientist.png',
  'Professional Gamer': '/careers/professional-gamer.png',
  Doctor: '/careers/doctor.png',
  Engineer: '/careers/engineer.png',
  Pilot: '/careers/pilot.png',
  Journalist: '/careers/journalist.png',
  Photographer: '/careers/photographer.png',
  Lawyer: '/careers/lawyer.png',
  Singer: '/careers/singer.png',
  Footballer: '/careers/footballer.png',
  Other: '/careers/other.png',
};

export default function CareerVisual({ career }: { career: string }) {
  const src = CAREER_IMAGES[career] || CAREER_IMAGES.Other;

  return (
    <span className="job-tile-icon career-visual" aria-hidden="true">
      <Image src={src} alt="" width={96} height={96} sizes="(max-width: 480px) 64px, 80px" />
    </span>
  );
}
