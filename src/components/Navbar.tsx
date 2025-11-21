import ikeaLogo from '../img/ikea.svg';
import { ThemeToggle } from './ThemeToggle';

const Navbar = () => {
  return (
    <nav className="fixed top-0 w-full z-50 py-6 bg-card/80 backdrop-blur-lg shadow-lg border-b border-border">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <img src={ikeaLogo} alt="IKEA" className="h-8 w-auto" />
        <h1 className="text-2xl font-bold text-foreground absolute left-1/2 transform -translate-x-1/2">
          Arbetsplatsplanering
        </h1>
        <ThemeToggle />
      </div>
    </nav>
  );
};

export default Navbar;
