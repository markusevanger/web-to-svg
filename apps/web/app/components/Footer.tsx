import Image from "next/image";
import Link from "next/link";
import ButtonGroup from "@/app/components/ButtonGroup";

export default function Footer() {
  return (
    <footer className="mt-24 px-6 lg:px-28 pb-8">
      <div className="bg-white rounded-xl border border-gray-200 px-6 lg:px-12 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-3">
            <Link href="/" className="cursor-pointer flex items-center gap-2">
              <Image
                src="/images/webtosvg-logo.svg"
                alt="Web to SVG"
                width={153}
                height={29}
                className="h-7 w-auto"
              />
            </Link>
            <p className="text-sm text-gray-500 max-w-xs">
              Click any element on a webpage and export it as a clean SVG or
              PNG.
            </p>
          </div>

          <ButtonGroup
            alignment="right"
            buttons={[
              {
                _key: "add-to-browser",
                buttonText: "Add to Browser",
                variant: "primary",
                icon: "Chrome",
                iconPosition: "left",
                link: {
                  _type: "link",
                  linkType: "href",
                  href: "https://chromewebstore.google.com",
                  openInNewTab: true,
                },
              },
            ]}
          />
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} Web to SVG</span>
          <span>
            Extension by{" "}
            <a
              href="https://markusevanger.no"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <span className="inline-block px-1.5 py-0.5 rounded bg-primary text-black font-bold text-[10px]">
                markusevanger.no
              </span>
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
