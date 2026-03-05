import Shape from "@/app/components/Shape";
import HeroButtons from "@/app/components/HeroButtons";
import {sanityFetch} from "@/sanity/lib/live";
import {settingsQuery} from "@/sanity/lib/queries";
import {DereferencedLink} from "@/sanity/lib/types";

export default async function Hero() {
  const {data: settings} = await sanityFetch({query: settingsQuery});

  const fallbackButton = settings?.demoFallbackButton
    ? {
        buttonText: settings.demoFallbackButton.buttonText,
        link: settings.demoFallbackButton.link as DereferencedLink | undefined,
        variant: (settings.demoFallbackButton.variant || 'primary') as 'primary' | 'secondary',
        icon: settings.demoFallbackButton.icon || undefined,
        iconPosition: (settings.demoFallbackButton.iconPosition || 'right') as 'left' | 'right',
      }
    : undefined;

  return (
    <section className="min-h-[80vh] flex flex-col items-center justify-center gap-8 px-4 py-16 text-black">
      <div className="max-w-5xl w-full">
        <h1 className="font-bold leading-[1.06] tracking-tight text-center text-6xl sm:text-7xl md:text-8xl lg:text-[7rem]">
          <span className="inline-flex items-center gap-[0.15em]">
            <Shape
              shape="circle"
              color="primary"
              size="0.55em"
              animate={{
                initial: { scale: 0, opacity: 0, rotate: -180 },
                animate: { scale: 1, opacity: 1, rotate: 0, y: [0, -6, 0] },
                transition: { type: "spring", stiffness: 300, damping: 15, y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } },
              }}
            />
            <span>GRAB</span>
            <Shape
              shape="triangle"
              color="yellow"
              size="0.55em"
              rotate={15}
              animate={{
                initial: { scale: 0, opacity: 0, rotate: -60 },
                animate: { scale: 1, opacity: 1, rotate: [15, 35, 15] },
                transition: { type: "spring", stiffness: 300, damping: 15, delay: 0.05, rotate: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } },
              }}
            />
          </span>
          <br />
          <span className="font-serif italic font-normal">ANYTHING</span>
          <br />
          <span className="inline-flex items-center gap-[0.15em]">
            <Shape
              shape="square"
              color="blue"
              size="0.55em"
              rotate={-15}
              animate={{
                initial: { scale: 0, opacity: 0, rotate: 90 },
                animate: { scale: 1, opacity: 1, rotate: [-15, 5, -15] },
                transition: { type: "spring", stiffness: 300, damping: 15, delay: 0.1, rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" } },
              }}
            />
            <span>AS</span>
            <Shape
              shape="star"
              color="pink"
              size="0.55em"
              animate={{
                initial: { scale: 0, opacity: 0, rotate: -90 },
                animate: { scale: [1, 1.2, 1], opacity: 1, rotate: 0 },
                transition: { type: "spring", stiffness: 300, damping: 15, delay: 0.15, scale: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } },
              }}
            />
            <span className="inline-block px-[0.06em] py-[0.01em] rounded-[0.12em] bg-primary">
              SVG
            </span>
          </span>
        </h1>
      </div>

      <p className="text-sm md:text-base text-center max-w-2xl text-balance">
        Click any element on a webpage and export it as a clean SVG or PNG file.
      </p>

      <HeroButtons fallbackButton={fallbackButton} />
    </section>
  );
}
