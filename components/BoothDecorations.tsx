'use client';

interface DecoItem {
  src: string;
  className: string;
  alt: string;
}

interface Props {
  step: 'info' | 'dreamJob' | 'camera' | 'done';
  basePath?: string;
}

const c = (name: string) => `/characters/${name}`;

const LAYOUTS: Record<string, DecoItem[]> = {
  info: [
    // Left side — top to bottom
    { src: c('01_basketball_hoop.png'), className: 'deco pos-tl-far', alt: '' },
    { src: c('02_basketball_player.png'), className: 'deco pos-tl', alt: '' },
    { src: c('03_painter.png'), className: 'deco pos-ml', alt: '' },
    { src: c('04_vr_user.png'), className: 'deco pos-bl-up', alt: '' },
    { src: c('10_hud_screen.png'), className: 'deco pos-bl', alt: '' },
    { src: c('08_scientist_with_flasks.png'), className: 'deco pos-bc-left', alt: '' },
    { src: c('11_microscope.png'), className: 'deco pos-bc-left-low', alt: '' },
    // Right side — top to bottom
    { src: c('06_student_with_books.png'), className: 'deco pos-tr', alt: '' },
    { src: c('07_woman_with_cat.png'), className: 'deco pos-mr', alt: '' },
    { src: c('05_graduate.png'), className: 'deco pos-br-up', alt: '' },
    { src: c('09_studying_student.png'), className: 'deco pos-br', alt: '' },
    // Bangla signs scattered
    { src: c('12_sign_01.png'), className: 'deco sign s1', alt: '' },
    { src: c('13_sign_02.png'), className: 'deco sign s2', alt: '' },
    { src: c('14_sign_03.png'), className: 'deco sign s3', alt: '' },
    { src: c('16_sign_05.png'), className: 'deco sign s5', alt: '' },
    { src: c('17_sign_06.png'), className: 'deco sign s6', alt: '' },
  ],
  dreamJob: [
    { src: c('01_basketball_hoop.png'), className: 'deco pos-tl-far', alt: '' },
    { src: c('02_basketball_player.png'), className: 'deco pos-tl', alt: '' },
    { src: c('03_painter.png'), className: 'deco pos-ml', alt: '' },
    { src: c('04_vr_user.png'), className: 'deco pos-bl-up', alt: '' },
    { src: c('08_scientist_with_flasks.png'), className: 'deco pos-bc-left', alt: '' },
    { src: c('10_hud_screen.png'), className: 'deco pos-bl', alt: '' },
    { src: c('06_student_with_books.png'), className: 'deco pos-tr', alt: '' },
    { src: c('07_woman_with_cat.png'), className: 'deco pos-mr', alt: '' },
    { src: c('05_graduate.png'), className: 'deco pos-br-up', alt: '' },
    { src: c('09_studying_student.png'), className: 'deco pos-br', alt: '' },
    { src: c('13_sign_02.png'), className: 'deco sign s2', alt: '' },
    { src: c('14_sign_03.png'), className: 'deco sign s3', alt: '' },
    { src: c('15_sign_04.png'), className: 'deco sign s4', alt: '' },
    { src: c('16_sign_05.png'), className: 'deco sign s5', alt: '' },
    { src: c('17_sign_06.png'), className: 'deco sign s6', alt: '' },
  ],
  camera: [
    // Fewer characters — focus on webcam
    { src: c('01_basketball_hoop.png'), className: 'deco pos-tl-far', alt: '' },
    { src: c('02_basketball_player.png'), className: 'deco pos-tl', alt: '' },
    { src: c('03_painter.png'), className: 'deco pos-ml', alt: '' },
    { src: c('04_vr_user.png'), className: 'deco pos-bl-up', alt: '' },
    { src: c('08_scientist_with_flasks.png'), className: 'deco pos-bc-left', alt: '' },
    { src: c('06_student_with_books.png'), className: 'deco pos-tr', alt: '' },
    { src: c('07_woman_with_cat.png'), className: 'deco pos-mr', alt: '' },
    { src: c('05_graduate.png'), className: 'deco pos-br-up', alt: '' },
    { src: c('12_sign_01.png'), className: 'deco sign s1', alt: '' },
    { src: c('16_sign_05.png'), className: 'deco sign s5', alt: '' },
  ],
  done: [
    // All characters — celebratory
    { src: c('01_basketball_hoop.png'), className: 'deco pos-tl-far', alt: '' },
    { src: c('02_basketball_player.png'), className: 'deco pos-tl', alt: '' },
    { src: c('03_painter.png'), className: 'deco pos-ml', alt: '' },
    { src: c('04_vr_user.png'), className: 'deco pos-bl-up', alt: '' },
    { src: c('10_hud_screen.png'), className: 'deco pos-bl', alt: '' },
    { src: c('08_scientist_with_flasks.png'), className: 'deco pos-bc-left', alt: '' },
    { src: c('11_microscope.png'), className: 'deco pos-bc-left-low', alt: '' },
    { src: c('06_student_with_books.png'), className: 'deco pos-tr', alt: '' },
    { src: c('07_woman_with_cat.png'), className: 'deco pos-mr', alt: '' },
    { src: c('05_graduate.png'), className: 'deco pos-br-up', alt: '' },
    { src: c('09_studying_student.png'), className: 'deco pos-br', alt: '' },
    { src: c('12_sign_01.png'), className: 'deco sign s1', alt: '' },
    { src: c('13_sign_02.png'), className: 'deco sign s2', alt: '' },
    { src: c('15_sign_04.png'), className: 'deco sign s4', alt: '' },
    { src: c('16_sign_05.png'), className: 'deco sign s5', alt: '' },
    { src: c('17_sign_06.png'), className: 'deco sign s6', alt: '' },
  ],
};

export default function BoothDecorations({ step }: Props) {
  const items = LAYOUTS[step] || LAYOUTS.info;
  return (
    <div className="deco-layer" aria-hidden="true">
      {items.map((item, i) => (
        <img key={`${step}-${i}`} src={item.src} alt={item.alt} className={item.className} draggable={false} loading="eager" />
      ))}
    </div>
  );
}
