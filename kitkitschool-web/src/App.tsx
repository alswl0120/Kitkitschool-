import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LauncherPage from './pages/LauncherPage'
import GameSelectPage from './pages/GameSelectPage'
import LibraryPage from './pages/LibraryPage'
import TappingGame from './pages/TappingGame'
import BookViewerPage from './pages/BookViewerPage'
import VideoPlayerPage from './pages/VideoPlayerPage'

// Shell (launcher) pages
const CoopScenePage = lazy(() => import('./pages/CoopScenePage'))
const DaySelectPage = lazy(() => import('./pages/DaySelectPage'))
const MainScenePage = lazy(() => import('./pages/MainScenePage'))

// Lazy load game pages to keep initial bundle small
const LetterMatchingPage = lazy(() => import('./pages/games/LetterMatchingPage'))
const NumberMatchingPage = lazy(() => import('./pages/games/NumberMatchingPage'))
const FindTheMatchPage = lazy(() => import('./pages/games/FindTheMatchPage'))
const CountingPage = lazy(() => import('./pages/games/CountingPage'))
const MovingInsectsPage = lazy(() => import('./pages/games/MovingInsectsPage'))
const HundredPuzzlePage = lazy(() => import('./pages/games/HundredPuzzlePage'))
const AnimalPuzzlePage = lazy(() => import('./pages/games/AnimalPuzzlePage'))
const WoodenPuzzlesPage = lazy(() => import('./pages/games/WoodenPuzzlesPage'))
const EquationMakerPage = lazy(() => import('./pages/games/EquationMakerPage'))
const FishTankPage = lazy(() => import('./pages/games/FishTankPage'))
const SentenceMakerPage = lazy(() => import('./pages/games/SentenceMakerPage'))
const WordMachinePage = lazy(() => import('./pages/games/WordMachinePage'))
const LetterTracePage = lazy(() => import('./pages/games/LetterTracePage'))
const NumberTracePage = lazy(() => import('./pages/games/NumberTracePage'))
const WordTracePage = lazy(() => import('./pages/games/WordTracePage'))
const SpellingPage = lazy(() => import('./pages/games/SpellingPage'))
const StarFallPage = lazy(() => import('./pages/games/StarFallPage'))
const DoubleDigitPage = lazy(() => import('./pages/games/DoubleDigitPage'))
const EggQuizPage = lazy(() => import('./pages/games/EggQuizPage'))
const ComprehensionTestPage = lazy(() => import('./pages/games/ComprehensionTestPage'))
const TutorialTracePage = lazy(() => import('./pages/games/TutorialTracePage'))
const OldSpellingPage = lazy(() => import('./pages/games/OldSpellingPage'))
const DigitalQuizPage = lazy(() => import('./pages/games/DigitalQuizPage'))
const MissingNumberPage = lazy(() => import('./pages/games/MissingNumberPage'))
const AlphabetPuzzlePage2 = lazy(() => import('./pages/games/AlphabetPuzzlePage'))
const NumberPuzzlePage2 = lazy(() => import('./pages/games/NumberPuzzlePage'))
const CompMatchingPage = lazy(() => import('./pages/games/CompMatchingPage'))
const LineMatchingPage = lazy(() => import('./pages/games/LineMatchingPage'))
const WhatIsThisPage = lazy(() => import('./pages/games/WhatIsThisPage'))
const SentenceBridgePage = lazy(() => import('./pages/games/SentenceBridgePage'))
const PatternTrainPage = lazy(() => import('./pages/games/PatternTrainPage'))
const NumberTrainPage = lazy(() => import('./pages/games/NumberTrainPage'))
const QuickFactsPage = lazy(() => import('./pages/games/QuickFactsPage'))
const FeedingTimePage = lazy(() => import('./pages/games/FeedingTimePage'))
const PlaceValuePage = lazy(() => import('./pages/games/PlaceValuePage'))
const WordMatrixPage = lazy(() => import('./pages/games/WordMatrixPage'))
const SoundTrainPage = lazy(() => import('./pages/games/SoundTrainPage'))
const MangoShopPage = lazy(() => import('./pages/games/MangoShopPage'))
const ShapeMatchingPage = lazy(() => import('./pages/games/ShapeMatchingPage'))
const WordKickerPage = lazy(() => import('./pages/games/WordKickerPage'))
const MathKickerPage = lazy(() => import('./pages/games/MathKickerPage'))
const ThirtyPuzzlePage = lazy(() => import('./pages/games/ThirtyPuzzlePage'))
const MultiplicationBoardPage = lazy(() => import('./pages/games/MultiplicationBoardPage'))
const LabelingPage = lazy(() => import('./pages/games/LabelingPage'))
const WordWindowPage = lazy(() => import('./pages/games/WordWindowPage'))
const LRComprehensionPage = lazy(() => import('./pages/games/LRComprehensionPage'))
const WordNotePage = lazy(() => import('./pages/games/WordNotePage'))
const NumberTraceExtPage = lazy(() => import('./pages/games/NumberTraceExtPage'))
const ReadingBirdPage = lazy(() => import('./pages/games/ReadingBirdPage'))
const BirdPhonicsPage = lazy(() => import('./pages/games/BirdPhonicsPage'))
const HundredChickensPage = lazy(() => import('./pages/games/HundredChickensPage'))
const BigSmallPage = lazy(() => import('./pages/games/BigSmallPage'))
const CrownPage = lazy(() => import('./pages/games/CrownPage'))
const KeypadPage = lazy(() => import('./pages/games/KeypadPage'))
const Count10Page = lazy(() => import('./pages/games/Count10Page'))
const AirShapesPage = lazy(() => import('./pages/games/AirShapesPage'))
const EqualsGreatLessPage = lazy(() => import('./pages/games/EqualsGreatLessPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ToolsMenuPage = lazy(() => import('./pages/ToolsMenuPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const ShopPage = lazy(() => import('./pages/ShopPage'))
const MyBirdPage = lazy(() => import('./pages/MyBirdPage'))
const ColoringBookPage = lazy(() => import('./pages/ColoringBookPage'))
const ABCPage = lazy(() => import('./pages/ABCPage'))

function Loading() {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#1a1a2e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 24,
    }}>
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<LauncherPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/tools" element={<ToolsMenuPage />} />
        <Route path="/tools/dashboard" element={<ToolsPage />} />
        <Route path="/tools/shop" element={<ShopPage />} />
        <Route path="/tools/mybird" element={<MyBirdPage />} />
        <Route path="/tools/coloring" element={<ColoringBookPage />} />
        <Route path="/tools/abc" element={<ABCPage />} />
        <Route path="/coop" element={<CoopScenePage />} />
        <Route path="/coop/:levelID" element={<DaySelectPage />} />
        <Route path="/coop/:levelID/day/:day" element={<MainScenePage />} />
        <Route path="/games" element={<GameSelectPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/game/tapping" element={<TappingGame />} />
        <Route path="/game/lettermatching" element={<LetterMatchingPage />} />
        <Route path="/game/numbermatching" element={<NumberMatchingPage />} />
        <Route path="/game/findthematch" element={<FindTheMatchPage />} />
        <Route path="/game/counting" element={<CountingPage />} />
        <Route path="/game/movinginsects" element={<MovingInsectsPage />} />
        <Route path="/game/hundredpuzzle" element={<HundredPuzzlePage />} />
        <Route path="/game/animalpuzzle" element={<AnimalPuzzlePage />} />
        <Route path="/game/woodenpuzzles" element={<WoodenPuzzlesPage />} />
        <Route path="/game/equationmaker" element={<EquationMakerPage />} />
        <Route path="/game/fishtank" element={<FishTankPage />} />
        <Route path="/game/sentencemaker" element={<SentenceMakerPage />} />
        <Route path="/game/wordmachine" element={<WordMachinePage />} />
        <Route path="/game/lettertrace" element={<LetterTracePage />} />
        <Route path="/game/numbertrace" element={<NumberTracePage />} />
        <Route path="/game/wordtrace" element={<WordTracePage />} />
        <Route path="/game/spelling" element={<SpellingPage />} />
        <Route path="/game/starfall" element={<StarFallPage />} />
        <Route path="/game/doubledigit" element={<DoubleDigitPage />} />
        <Route path="/game/eggquiz" element={<EggQuizPage />} />
        <Route path="/game/comprehensiontest" element={<ComprehensionTestPage />} />
        <Route path="/game/tutorialtrace" element={<TutorialTracePage />} />
        <Route path="/game/oldspelling" element={<OldSpellingPage />} />
        <Route path="/game/digitalquiz" element={<DigitalQuizPage />} />
        <Route path="/game/missingnumber" element={<MissingNumberPage />} />
        <Route path="/game/alphabetpuzzle" element={<AlphabetPuzzlePage2 />} />
        <Route path="/game/numberpuzzle" element={<NumberPuzzlePage2 />} />
        <Route path="/game/compmatching" element={<CompMatchingPage />} />
        <Route path="/game/linematching" element={<LineMatchingPage />} />
        <Route path="/game/whatisthis" element={<WhatIsThisPage />} />
        <Route path="/game/sentencebridge" element={<SentenceBridgePage />} />
        <Route path="/game/patterntrain" element={<PatternTrainPage />} />
        <Route path="/game/numbertrain" element={<NumberTrainPage />} />
        <Route path="/game/wordmatrix" element={<WordMatrixPage />} />
        <Route path="/game/soundtrain" element={<SoundTrainPage />} />
        <Route path="/game/quickfacts" element={<QuickFactsPage />} />
        <Route path="/game/feedingtime" element={<FeedingTimePage />} />
        <Route path="/game/placevalue" element={<PlaceValuePage />} />
        <Route path="/game/mangoshop" element={<MangoShopPage />} />
        <Route path="/game/shapematching" element={<ShapeMatchingPage />} />
        <Route path="/game/wordkicker" element={<WordKickerPage />} />
        <Route path="/game/mathkicker" element={<MathKickerPage />} />
        <Route path="/game/thirtypuzzle" element={<ThirtyPuzzlePage />} />
        <Route path="/game/multiplicationboard" element={<MultiplicationBoardPage />} />
        <Route path="/game/labeling" element={<LabelingPage />} />
        <Route path="/game/wordwindow" element={<WordWindowPage />} />
        <Route path="/game/lrcomprehension" element={<LRComprehensionPage />} />
        <Route path="/game/wordnote" element={<WordNotePage />} />
        <Route path="/game/numbertraceext" element={<NumberTraceExtPage />} />
        <Route path="/game/readingbird" element={<ReadingBirdPage />} />
        <Route path="/game/birdphonics" element={<BirdPhonicsPage />} />
        <Route path="/game/hundredchickens" element={<HundredChickensPage />} />
        <Route path="/game/bigsmall" element={<BigSmallPage />} />
        <Route path="/game/crown" element={<CrownPage />} />
        <Route path="/game/keypad" element={<KeypadPage />} />
        <Route path="/game/count10" element={<Count10Page />} />
        <Route path="/game/airshapes" element={<AirShapesPage />} />
        <Route path="/game/equalsgreatless" element={<EqualsGreatLessPage />} />
        <Route path="/book/:id" element={<BookViewerPage />} />
        <Route path="/video/:id" element={<VideoPlayerPage />} />
      </Routes>
    </Suspense>
  )
}
