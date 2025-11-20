import ikeaLogo from '../img/ikea.svg';

const Navbar = () => {
  return (
    <nav className="font-onest fixed top-0 w-full z-50 py-6 bg-[rgba(8, 26, 58, 0.8)] backdrop-blur-lg shadow-lg">
      <div className="container mx-auto px-4 flex items-center">
        <img src={ikeaLogo} alt="IKEA" className="h-8 w-auto" />
        <h1 className="text-2xl font-bold bg-clip-text text-transparent absolute left-1/2 transform -translate-x-1/2">
          Arbetsplatsplanering
        </h1>
      </div>
    </nav>
  );
};

export default Navbar;