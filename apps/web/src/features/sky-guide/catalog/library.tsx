import type * as React from "react";
import HoloCard from "~/components/react-bits/holo-card";
import CircularCarousel from "~/components/react-bits/circular-carousel";
import FlexCarousel from "~/components/react-bits/flex-carousel";
import InfiniteSpiral from "~/components/react-bits/infinite-spiral";
import DepthCarousel from "~/components/react-bits/depth-carousel";
import MorphSlider from "~/components/react-bits/morph-slider";
import DriftWall from "~/components/react-bits/drift-wall";
import AccordionGallery from "~/components/react-bits/accordion-gallery";
import SpecularButton from "~/components/react-bits/specular-button";
import OptionWheel from "~/components/react-bits/option-wheel";
import CurvedInput from "~/components/react-bits/curved-input";
import LineSidebar from "~/components/react-bits/line-sidebar";
import AnimatedList from "~/components/react-bits/animated-list";
import ScrollStack from "~/components/react-bits/scroll-stack";
import BubbleMenu from "~/components/react-bits/bubble-menu";
import MagicBento from "~/components/react-bits/magic-bento";
import CircularGallery from "~/components/react-bits/circular-gallery";
import ReflectiveCard from "~/components/react-bits/reflective-card";
import CardNav from "~/components/react-bits/card-nav";
import Stack from "~/components/react-bits/stack";
import FluidGlass from "~/components/react-bits/fluid-glass";
import PillNav from "~/components/react-bits/pill-nav";
import TiltedCard from "~/components/react-bits/tilted-card";
import Masonry from "~/components/react-bits/masonry";
import GlassSurface from "~/components/react-bits/glass-surface";
import DomeGallery from "~/components/react-bits/dome-gallery";
import ChromaGrid from "~/components/react-bits/chroma-grid";
import Folder from "~/components/react-bits/folder";
import StaggeredMenu from "~/components/react-bits/staggered-menu";
import ModelViewer from "~/components/react-bits/model-viewer";
import Lanyard from "~/components/react-bits/lanyard";
import ProfileCard from "~/components/react-bits/profile-card";
import Dock from "~/components/react-bits/dock";
import GooeyNav from "~/components/react-bits/gooey-nav";
import PixelCard from "~/components/react-bits/pixel-card";
import Carousel from "~/components/react-bits/carousel";
import SpotlightCard from "~/components/react-bits/spotlight-card";
import BorderGlow from "~/components/react-bits/border-glow";
import FlyingPosters from "~/components/react-bits/flying-posters";
import CardSwap from "~/components/react-bits/card-swap";
import GlassIcons from "~/components/react-bits/glass-icons";
import DecayCard from "~/components/react-bits/decay-card";
import FlowingMenu from "~/components/react-bits/flowing-menu";
import ElasticSlider from "~/components/react-bits/elastic-slider";
import Counter from "~/components/react-bits/counter";
import InfiniteMenu from "~/components/react-bits/infinite-menu";
import Stepper from "~/components/react-bits/stepper";
import BounceCards from "~/components/react-bits/bounce-cards";

export interface SkyLibraryEntry { slug: string; name: string; component: React.ComponentType<any>; }

export const skyLibrary: SkyLibraryEntry[] = [
  { slug: "holo-card", name: "HoloCard", component: HoloCard },
  { slug: "circular-carousel", name: "CircularCarousel", component: CircularCarousel },
  { slug: "flex-carousel", name: "FlexCarousel", component: FlexCarousel },
  { slug: "infinite-spiral", name: "InfiniteSpiral", component: InfiniteSpiral },
  { slug: "depth-carousel", name: "DepthCarousel", component: DepthCarousel },
  { slug: "morph-slider", name: "MorphSlider", component: MorphSlider },
  { slug: "drift-wall", name: "DriftWall", component: DriftWall },
  { slug: "accordion-gallery", name: "AccordionGallery", component: AccordionGallery },
  { slug: "specular-button", name: "SpecularButton", component: SpecularButton },
  { slug: "option-wheel", name: "OptionWheel", component: OptionWheel },
  { slug: "curved-input", name: "CurvedInput", component: CurvedInput },
  { slug: "line-sidebar", name: "LineSidebar", component: LineSidebar },
  { slug: "animated-list", name: "AnimatedList", component: AnimatedList },
  { slug: "scroll-stack", name: "ScrollStack", component: ScrollStack },
  { slug: "bubble-menu", name: "BubbleMenu", component: BubbleMenu },
  { slug: "magic-bento", name: "MagicBento", component: MagicBento },
  { slug: "circular-gallery", name: "CircularGallery", component: CircularGallery },
  { slug: "reflective-card", name: "ReflectiveCard", component: ReflectiveCard },
  { slug: "card-nav", name: "CardNav", component: CardNav },
  { slug: "stack", name: "Stack", component: Stack },
  { slug: "fluid-glass", name: "FluidGlass", component: FluidGlass },
  { slug: "pill-nav", name: "PillNav", component: PillNav },
  { slug: "tilted-card", name: "TiltedCard", component: TiltedCard },
  { slug: "masonry", name: "Masonry", component: Masonry },
  { slug: "glass-surface", name: "GlassSurface", component: GlassSurface },
  { slug: "dome-gallery", name: "DomeGallery", component: DomeGallery },
  { slug: "chroma-grid", name: "ChromaGrid", component: ChromaGrid },
  { slug: "folder", name: "Folder", component: Folder },
  { slug: "staggered-menu", name: "StaggeredMenu", component: StaggeredMenu },
  { slug: "model-viewer", name: "ModelViewer", component: ModelViewer },
  { slug: "lanyard", name: "Lanyard", component: Lanyard },
  { slug: "profile-card", name: "ProfileCard", component: ProfileCard },
  { slug: "dock", name: "Dock", component: Dock },
  { slug: "gooey-nav", name: "GooeyNav", component: GooeyNav },
  { slug: "pixel-card", name: "PixelCard", component: PixelCard },
  { slug: "carousel", name: "Carousel", component: Carousel },
  { slug: "spotlight-card", name: "SpotlightCard", component: SpotlightCard },
  { slug: "border-glow", name: "BorderGlow", component: BorderGlow },
  { slug: "flying-posters", name: "FlyingPosters", component: FlyingPosters },
  { slug: "card-swap", name: "CardSwap", component: CardSwap },
  { slug: "glass-icons", name: "GlassIcons", component: GlassIcons },
  { slug: "decay-card", name: "DecayCard", component: DecayCard },
  { slug: "flowing-menu", name: "FlowingMenu", component: FlowingMenu },
  { slug: "elastic-slider", name: "ElasticSlider", component: ElasticSlider },
  { slug: "counter", name: "Counter", component: Counter },
  { slug: "infinite-menu", name: "InfiniteMenu", component: InfiniteMenu },
  { slug: "stepper", name: "Stepper", component: Stepper },
  { slug: "bounce-cards", name: "BounceCards", component: BounceCards },
];
