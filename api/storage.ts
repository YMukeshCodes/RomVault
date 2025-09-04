import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name in ES module compatible way
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the data types
export interface GameData {
  id: string;
  title: string;
  platform: string;
  console: string;
  category: string;
  categoryId: string;
  image: string;
  rating: number;
  downloads: number;
  year: number;
  region: string;
  fileName: string;
  size: string;
  downloadUrl: string;
  description: string | null;
  longDescription: string | null;
  reviewCount: number;
}

export interface CategoryData {
  id: string;
  name: string;
  description: string;
  image: string;
  gameCount: number;
  downloadCount: number;
}

export interface RomData {
  categories: CategoryData[];
  games: GameData[];
  stats: {
    totalGames: number;
    totalCategories: number;
    totalDownloads: string;
    activeUsers: string;
  };
}

export interface IStorage {
  getRomData(): Promise<RomData>;
  getCategories(): Promise<CategoryData[]>;
  getCategory(id: string): Promise<CategoryData | undefined>;
  getGames(params?: {
    categoryId?: string;
    console?: string;
    search?: string;
    sortBy?: 'downloads' | 'rating' | 'year' | 'title';
    page?: number;
    limit?: number;
  }): Promise<{ games: GameData[]; total: number }>;
  getGame(id: string): Promise<GameData | undefined>;
  getGameBySlug(console: string, slug: string): Promise<GameData | undefined>;
  getPopularGames(limit?: number): Promise<GameData[]>;
  getConsoles(): Promise<string[]>;
}

export class MemStorage implements IStorage {
  private romData: RomData | null = null;
  private dataDir: string;

  constructor() {
    // Initialize dataDir with fallback value
    this.dataDir = path.resolve(process.cwd(), "data");

    // In Vercel, the data directory might be in a different location
    // Try multiple possible locations
    const possiblePaths = [
      path.resolve(process.cwd(), "data"),
      path.resolve(__dirname, "..", "data"),
      "/var/task/data", // Vercel's deployment directory
      "/var/task/dist/data", // Vercel with dist directory
      path.resolve(process.cwd(), "..", "data"), // One level up
      path.resolve(process.cwd(), "..", "..", "data"), // Two levels up
      path.resolve(__dirname, "..", "..", "data"), // Two levels up from __dirname
      path.resolve(__dirname, "..", "..", "..", "data") // Three levels up from __dirname
    ];

    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`__dirname: ${__dirname}`);

    for (const dataPath of possiblePaths) {
      try {
        console.log(`Trying data path: ${dataPath}`);
        const stat = fsSync.statSync(dataPath);
        if (stat.isDirectory()) {
          const files = fsSync.readdirSync(dataPath);
          console.log(`Found data directory at: ${dataPath} with ${files.length} files`);
          // Check if this directory contains JSON files
         const jsonFiles = files.filter(file => file.endsWith('_roms.json'));
         if (jsonFiles.length > 0) {
           this.dataDir = dataPath;
           console.log(`Using data directory with ROM files: ${dataPath} with ${jsonFiles.length} JSON files`);
           break;
         } else {
           console.log(`Data directory ${dataPath} has no JSON files`);
         }
       }
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.log(`Failed to access ${dataPath}:`, errorMessage);
       // Continue to next path
     }
   }

   console.log(`Final data directory: ${this.dataDir}`);
 }

  private async loadData(): Promise<RomData> {
    if (!this.romData) {
      try {
        console.log(`Attempting to load data from: ${this.dataDir}`);
        console.log(`Current working directory: ${process.cwd()}`);
        console.log(`__dirname: ${__dirname}`);

        // Check if data directory exists
        try {
          const stat = await fs.stat(this.dataDir);
          if (!stat.isDirectory()) {
            throw new Error(`Data path is not a directory: ${this.dataDir}`);
          }
        } catch (error) {
          console.error(`Data directory does not exist or is not accessible: ${this.dataDir}`, error);
          // List all files in current directory to help debug
          try {
            const currentDirFiles = await fs.readdir(process.cwd());
            console.log(`Files in current directory (${process.cwd()}):`, currentDirFiles);
          } catch (listError) {
            console.error(`Failed to list files in current directory:`, listError);
          }
          throw new Error(`Data directory not found: ${this.dataDir}`);
        }

        // Get all JSON files in data directory
        const files = await fs.readdir(this.dataDir);
        console.log(`Found ${files.length} files in data directory:`, files);

        const jsonFiles = files.filter(file => file.endsWith('_roms.json'));
        console.log(`Found ${jsonFiles.length} JSON files:`, jsonFiles);

        if (jsonFiles.length === 0) {
          console.error(`No JSON files found in ${this.dataDir}`);
          throw new Error(`No JSON files found in data directory`);
        }

        let allGames: GameData[] = [];
        const categories: CategoryData[] = [];
        const consoleMap = new Map<string, string>();

        // Console name mappings
        const consoleNames: Record<string, string> = {
          '3do': '3DO',
          '3ds': '3DS',
          'acorn_archimedes': 'Acorn Archimedes',
          'acorn_atom': 'Acorn Atom',
          'action_max': 'Action Max',
          'amiga': 'Amiga',
          'amstrad_cpc': 'Amstrad CPC',
          'amstrad_gx4000': 'Amstrad GX4000',
          'apple_2_gs': 'Apple IIgs',
          'apple_2': 'Apple II',
          'atari_2600': 'Atari 2600',
          'atari_5200': 'Atari 5200',
          'atari_7800': 'Atari 7800',
          'atari_8_bit': 'Atari 8-bit',
          'atari_jaguar': 'Atari Jaguar',
          'atari_lynx': 'Atari Lynx',
          'atari_st': 'Atari ST',
          'bally_astrocade': 'Bally Astrocade',
          'bbc_micro': 'BBC Micro',
          'capcom_play_system_1': 'Capcom Play System 1',
          'cd_i': 'CD-i',
          'colecovision': 'ColecoVision',
          'commodore_64_preservation': 'Commodore 64',
          'commodore_64_tapes': 'Commodore 64 Tapes',
          'commodore_vic_20': 'Commodore VIC-20',
          'cps2': 'Capcom Play System 2',
          'cps3': 'Capcom Play System 3',
          'dos': 'DOS',
          'famicom': 'Famicom',
          'fm_7': 'FM-7',
          'gamate': 'Gamate',
          'gameboy_color': 'Game Boy Color',
          'gameboy': 'Game Boy',
          'gamecube': 'GameCube',
          'gba': 'Game Boy Advance',
          'gce_vectrex': 'GCE Vectrex',
          'intellivision': 'Intellivision',
          'magnavox_odissey_2': 'Magnavox Odyssey²',
          'mame': 'Arcade (MAME)',
          'msx_2': 'MSX2',
          'msx': 'MSX',
          'n64': 'Nintendo 64',
          'n_gage': 'N-Gage',
          'nds': 'Nintendo DS',
          'neo_geo_pocket': 'Neo Geo Pocket',
          'nes': 'Nintendo Entertainment System',
          'new_geo': 'Neo Geo',
          'nintendo_wii_u': 'Nintendo Wii U',
          'pc_fx': 'PC-FX',
          'playstation_4': 'PlayStation 4',
          'playstation': 'PlayStation',
          'playstation_vita': 'PlayStation Vita',
          'pokemon_mini': 'Pokémon Mini',
          'ps2': 'PlayStation 2',
          'ps3': 'PlayStation 3',
          'psp': 'PlayStation Portable',
          'sam_coupe': 'SAM Coupé',
          'satellaview': 'Satellaview',
          'scummvm': 'ScummVM',
          'sega_32x': 'Sega 32X',
          'sega_cd': 'Sega CD',
          'sega_dreamcast': 'Sega Dreamcast',
          'sega_game_gear': 'Sega Game Gear',
          'sega_genesis': 'Sega Genesis',
          'sega_master_system': 'Sega Master System',
          'sega_naomi': 'Sega Naomi',
          'sega_pico': 'Sega Pico',
          'sega_saturn': 'Sega Saturn',
          'sg_1000': 'SG-1000',
          'sharp': 'Sharp',
          'snes': 'Super Nintendo Entertainment System',
          'super_cassette_vision': 'Super Cassette Vision',
          'switch': 'Nintendo Switch',
          'tandy_trs_80': 'Tandy TRS-80',
          'tatung_einstein': 'Tatung Einstein',
          'tiger_game_com': 'Tiger Game.com',
          'trs_80_color_computer': 'TRS-80 Color Computer',
          'turbo_duo': 'TurboGrafx-16/PC Engine',
          'turbografx16': 'TurboGrafx-16',
          'videopac_g7400': 'Videopac+ G7400',
          'virtual_boy': 'Virtual Boy',
          'watara_supervision': 'Watara Supervision',
          'wii': 'Nintendo Wii',
          'wonderswan_color': 'WonderSwan Color',
          'wonderswan': 'WonderSwan',
          'xbox_one': 'Xbox One',
          'xbox': 'Xbox',
          'z_machine': 'Z-Machine',
          'zx81': 'ZX81',
          'zx_spectrum': 'ZX Spectrum'
        };

        // Real download data mapping based on provided data (for sorting)
        const realDownloadCounts: Record<string, number> = {
          'psp': 21871621,
          'ps2': 7768966,
          'gba': 6930074,
          'nds': 3811847,
          '3ds': 3199342,
          'wii': 2320853,
          'gamecube': 2217746,
          'ps3': 2049626,
          'mame': 1830746,
          'n64': 1625508,
          'snes': 1533725,
          'playstation': 1328110,
          'nes': 1024524,
          'switch': 766031,
          'gameboy_color': 609353,
          'sega_genesis': 472446,
          'zx_spectrum': 386624,
          'sega_dreamcast': 298690,
          'amstrad_cpc': 290142,
          'dos': 289487,
          'amiga': 268800,
          'xbox': 253893,
          'new_geo': 213207,
          'sega_cd': 209624,
          'gameboy': 197872,
          'atari_st': 186536,
          'sharp': 182908,
          'sega_saturn': 112919,
          'sega_naomi': 93595,
          'atari_2600': 82556,
          'nintendo_wii_u': 81622,
          'sega_game_gear': 70312,
          'sega_master_system': 65278,
          'bbc_micro': 57832,
          'msx': 53251,
          'turbografx16': 46977,
          'capcom_play_system_1': 45741,
          'tandy_trs_80': 37969,
          'cd_i': 33824,
          'cps2': 32492,
          'sega_pico': 25339,
          'satellaview': 24178,
          'intellivision': 24147,
          'sega_32x': 23920,
          'colecovision': 23815,
          'xbox_one': 22087,
          'n_gage': 18836,
          'msx_2': 18370,
          'famicom': 18100,
          '3do': 17572,
          'scummvm': 17257,
          'gce_vectrex': 15932,
          'atari_lynx': 15555,
          'atari_5200': 15454,
          'neo_geo_pocket': 15285,
          'atari_jaguar': 14095,
          'cps3': 13645,
          'atari_7800': 13238,
          'playstation_vita': 12979,
          'playstation_4': 12946,
          'commodore_64_preservation': 11773,
          'wonderswan_color': 11475,
          'wonderswan': 11461,
          'acorn_archimedes': 11087,
          'sam_coupe': 10189,
          'pokemon_mini': 9670,
          'commodore_64_tapes': 9508,
          'virtual_boy': 9120,
          'apple_2': 8971,
          'pc_fx': 7319,
          'atari_8_bit': 5986,
          'trs_80_color_computer': 5401,
          'commodore_vic_20': 5092,
          'gamate': 4868,
          'tiger_game_com': 4851,
          'amstrad_gx4000': 4658,
          'magnavox_odissey_2': 4591,
          'videopac_g7400': 4156,
          'turbo_duo': 3990,
          'acorn_atom': 3509,
          'tatung_einstein': 3385,
          'action_max': 2995,
          'super_cassette_vision': 2808,
          'apple_2_gs': 2764,
          'sg_1000': 2561
        };

        // Actual game counts from the provided data
        const actualGameCounts: Record<string, number> = {
          'psp': 787,
          'ps2': 288,
          'gba': 2046,
          'nds': 2123,
          '3ds': 117,
          'wii': 91,
          'gamecube': 239,
          'ps3': 41,
          'mame': 1234,
          'n64': 877,
          'snes': 1429,
          'playstation': 339,
          'nes': 1146,
          'switch': 9,
          'gameboy_color': 926,
          'sega_genesis': 1026,
          'zx_spectrum': 5847,
          'sega_dreamcast': 114,
          'amstrad_cpc': 4938,
          'dos': 4110,
          'amiga': 3185,
          'xbox': 24,
          'new_geo': 206,
          'sega_cd': 103,
          'gameboy': 574,
          'atari_st': 2817,
          'sharp': 2866,
          'sega_saturn': 103,
          'sega_naomi': 71,
          'atari_2600': 440,
          'nintendo_wii_u': 8,
          'sega_game_gear': 326,
          'sega_master_system': 368,
          'bbc_micro': 1027,
          'msx': 602,
          'turbografx16': 103,
          'capcom_play_system_1': 100,
          'tandy_trs_80': 655,
          'cd_i': 46,
          'cps2': 100,
          'sega_pico': 332,
          'satellaview': 242,
          'intellivision': 233,
          'sega_32x': 55,
          'colecovision': 302,
          'xbox_one': 3,
          'n_gage': 18,
          'msx_2': 163,
          'famicom': 100,
          '3do': 17,
          'scummvm': 16,
          'gce_vectrex': 174,
          'atari_lynx': 85,
          'atari_5200': 93,
          'neo_geo_pocket': 77,
          'atari_jaguar': 56,
          'cps3': 6,
          'atari_7800': 59,
          'playstation_vita': 2,
          'playstation_4': 2,
          'commodore_64_preservation': 96,
          'wonderswan_color': 96,
          'wonderswan': 123,
          'acorn_archimedes': 155,
          'sam_coupe': 139,
          'pokemon_mini': 15,
          'commodore_64_tapes': 100,
          'virtual_boy': 17,
          'apple_2': 103,
          'pc_fx': 20,
          'atari_8_bit': 18,
          'trs_80_color_computer': 73,
          'commodore_vic_20': 22,
          'gamate': 58,
          'tiger_game_com': 17,
          'amstrad_gx4000': 19,
          'magnavox_odissey_2': 23,
          'videopac_g7400': 34,
          'turbo_duo': 16,
          'acorn_atom': 36,
          'tatung_einstein': 51,
          'action_max': 5,
          'super_cassette_vision': 19,
          'apple_2_gs': 16,
          'sg_1000': 16
        };

        // Mapping for console keys to full descriptive IDs with -roms suffix
        const consoleIdMapping: Record<string, string> = {
          'psp': 'playstation-portable-roms',
          'ps2': 'playstation-2-roms',
          '3ds': 'nintendo-3ds-roms',
          'gba': 'gameboy-advance-roms',
          'n64': 'nintendo-64-roms',
          'nds': 'nintendo-ds-roms',
          'ps3': 'playstation-3-roms',
          'wii': 'nintendo-wii-roms',
          'snes': 'super-nintendo-roms',
          'nes': 'nintendo-roms',
          'playstation': 'playstation-roms',
          'gamecube': 'nintendo-gamecube-roms',
          'switch': 'nintendo-switch-roms',
          'xbox': 'microsoft-xbox-roms',
          'xbox_one': 'microsoft-xbox-one-roms',
          'gameboy': 'gameboy-roms',
          'gameboy_color': 'gameboy-color-roms',
          'mame': 'arcade-mame-roms',
          'playstation_vita': 'playstation-vita-roms',
          'playstation_4': 'playstation-4-roms',
          'nintendo_wii_u': 'nintendo-wii-u-roms'
        };

        // Process each console's ROM file
        for (const file of jsonFiles) {
          const consoleKey = file.replace('_roms.json', '');
          const consoleName = consoleNames[consoleKey] || consoleKey.toUpperCase();
          // Create URL-friendly console ID with descriptive names and -roms suffix
          const consoleId = consoleIdMapping[consoleKey] || `${consoleKey.replace(/_/g, '-')}-roms`;
          const filePath = path.join(this.dataDir, file);

          try {
            console.log(`Processing file: ${filePath}`);
            const fileData = await fs.readFile(filePath, "utf-8");
            console.log(`File ${file} size: ${fileData.length} characters`);

            const games = JSON.parse(fileData) as any[];
            console.log(`Parsed ${games.length} games from ${file}`);

            // Convert each game to our format
            const convertedGames: GameData[] = games.map((game, index) => {
              const downloads = parseInt(game.downloads) || 0;
              // Generate rating based on downloads (more downloads = better rating)
              let rating = 3.0; // Base rating
              if (downloads > 500000) rating = 4.8 + Math.random() * 0.2;
              else if (downloads > 300000) rating = 4.5 + Math.random() * 0.3;
              else if (downloads > 150000) rating = 4.0 + Math.random() * 0.5;
              else if (downloads > 50000) rating = 3.5 + Math.random() * 0.5;
              else rating = 3.0 + Math.random() * 0.7;

              return {
                id: game.slug || `${consoleKey}-${index}`,
                title: game.title,
                platform: consoleName,
                console: game.console || consoleKey.toUpperCase(),
                category: game.category === 'N/A' ? 'Other' : (game.category || 'Other'),
                categoryId: consoleId,
                image: game.image || '',
                rating: Math.round(rating * 10) / 10, // Round to 1 decimal
                downloads: downloads,
                year: game.release_year === 'N/A' ? 2000 : parseInt(game.release_year) || 2000,
                region: game.region || 'Unknown',
                fileName: game.file_name,
                size: game.size === 'unknown' ? 'Unknown' : game.size,
                downloadUrl: game.download_url,
                description: null,
                longDescription: null,
                reviewCount: Math.floor(Math.random() * 1000) + 100
              };
            });

            allGames.push(...convertedGames);
            console.log(`Added ${convertedGames.length} games from ${file}`);

            // Create category for this console - use actual game count for display, download count for sorting
            const actualGameCount = actualGameCounts[consoleKey] || convertedGames.length;
            const downloadCount = realDownloadCounts[consoleKey] || 0;

            categories.push({
              id: consoleId,
              name: `${consoleName} ROMs`,
              description: `${consoleName} ROM collection`,
              image: convertedGames[0]?.image || '',
              gameCount: actualGameCount,
              downloadCount: downloadCount // Add download count for sorting
            });

          } catch (error) {
            console.error(`Failed to load ${file}:`, error);
          }
        }

        this.romData = {
          categories,
          games: allGames,
          stats: {
            totalGames: allGames.length,
            totalCategories: categories.length,
            totalDownloads: Math.floor(allGames.reduce((sum, game) => sum + game.downloads, 0) / 1000) + "K",
            activeUsers: Math.floor(Math.random() * 50000 + 10000).toLocaleString()
          }
        };
      } catch (error) {
        console.error("Failed to load ROM data:", error);
        // Return empty data structure if files don't exist
        this.romData = {
          categories: [],
          games: [],
          stats: {
            totalGames: 0,
            totalCategories: 0,
            totalDownloads: "0",
            activeUsers: "0"
          }
        };
      }
    }
    return this.romData;
  }

  async getRomData(): Promise<RomData> {
    const data = await this.loadData();
    if (!data) {
      throw new Error("Failed to load ROM data");
    }
    return data;
  }

  async getCategories(): Promise<CategoryData[]> {
    const data = await this.loadData();
    return data.categories;
  }

  async getCategory(id: string): Promise<CategoryData | undefined> {
    const data = await this.loadData();
    return data.categories.find(cat => cat.id === id);
  }

  async getGames(params: {
    categoryId?: string;
    console?: string;
    category?: string;
    search?: string;
    sortBy?: 'downloads' | 'rating' | 'year' | 'title';
    page?: number;
    limit?: number;
  } = {}): Promise<{ games: GameData[]; total: number }> {
    const data = await this.loadData();
    let games = [...data.games];

    // Filter by category ID
    if (params.categoryId) {
      games = games.filter(game => game.categoryId === params.categoryId);
    }

    // Filter by category name
    if (params.category) {
      games = games.filter(game => game.category.toLowerCase() === params.category!.toLowerCase());
    }

    // Filter by console
    if (params.console) {
      games = games.filter(game => game.console.toLowerCase() === params.console!.toLowerCase());
    }

    // Filter by search term
    if (params.search) {
      const searchTerm = params.search.toLowerCase();
      games = games.filter(game =>
        game.title.toLowerCase().includes(searchTerm) ||
        game.platform.toLowerCase().includes(searchTerm)
      );
    }

    // Sort games
    if (params.sortBy) {
      games.sort((a, b) => {
        switch (params.sortBy) {
          case 'downloads':
            return b.downloads - a.downloads;
          case 'rating':
            return b.rating - a.rating;
          case 'year':
            return b.year - a.year;
          case 'title':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
    }

    const total = games.length;

    // Pagination
    if (params.page && params.limit) {
      const start = (params.page - 1) * params.limit;
      games = games.slice(start, start + params.limit);
    }

    return { games, total };
  }

  async getGame(id: string): Promise<GameData | undefined> {
    const data = await this.loadData();
    return data.games.find(game => game.id === id);
  }

  async getPopularGames(limit: number = 4): Promise<GameData[]> {
    const data = await this.loadData();
    return [...data.games]
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }

  async getGameBySlug(consoleName: string, slug: string): Promise<GameData | undefined> {
    const data = await this.loadData();
    
    // Mapping for console keys to full descriptive IDs with -roms suffix
    const consoleIdMapping: Record<string, string> = {
      'psp': 'playstation-portable-roms',
      'ps2': 'playstation-2-roms',
      '3ds': 'nintendo-3ds-roms',
      'gba': 'gameboy-advance-roms',
      'n64': 'nintendo-64-roms',
      'nds': 'nintendo-ds-roms',
      'ps3': 'playstation-3-roms',
      'wii': 'nintendo-wii-roms',
      'snes': 'super-nintendo-roms',
      'nes': 'nintendo-roms',
      'playstation': 'playstation-roms',
      'gamecube': 'nintendo-gamecube-roms',
      'switch': 'nintendo-switch-roms',
      'xbox': 'microsoft-xbox-roms',
      'xbox_one': 'microsoft-xbox-one-roms',
      'gameboy': 'gameboy-roms',
      'gameboy_color': 'gameboy-color-roms',
      'mame': 'arcade-mame-roms',
      'playstation_vita': 'playstation-vita-roms',
      'playstation_4': 'playstation-4-roms',
      'nintendo_wii_u': 'nintendo-wii-u-roms'
    };
    
    // Check if consoleName is already the full console ID
    // This happens when the console parameter in the URL is the full ID (e.g., playstation-portable-roms)
    // rather than the short key (e.g., psp)
    let consoleId;
    if (Object.values(consoleIdMapping).includes(consoleName)) {
      // consoleName is already the full console ID
      consoleId = consoleName;
    } else {
      // consoleName is the short key, map it to the full ID
      consoleId = consoleIdMapping[consoleName] || `${consoleName.replace(/_/g, '-')}-roms`;
    }
    
    console.log(`Searching for game with slug: ${slug} and consoleId: ${consoleId}`);
    
    // Find the game by ID (slug) and console category ID
    const foundGame = data.games.find(game => game.id === slug && game.categoryId === consoleId);
    
    if (!foundGame) {
      // Let's do some additional debugging
      console.log(`No exact match found. Looking for games with slug: ${slug}`);
      const slugMatches = data.games.filter(game => game.id === slug);
      console.log(`Found ${slugMatches.length} games with matching slug`);
      if (slugMatches.length > 0) {
        // Create a simple array of game info for logging
        const gameInfo = slugMatches.slice(0, 3).map(g => ({
          id: g.id,
          title: g.title,
          categoryId: g.categoryId,
          console: g.console
        }));
        console.log(`Sample slug matches:`, gameInfo);
      }
      
      // Also check if there are any games for this console
      const consoleGames = data.games.filter(game => game.categoryId === consoleId);
      console.log(`Found ${consoleGames.length} games for consoleId: ${consoleId}`);
      if (consoleGames.length > 0) {
        console.log(`Sample console games:`, consoleGames.slice(0, 3).map(g => ({
          id: g.id,
          title: g.title,
          categoryId: g.categoryId
        })));
      }
      
      // Let's also check if there are any games that contain the slug as a substring
      const partialSlugMatches = data.games.filter(game =>
        game.id.includes(slug) ||
        game.title.toLowerCase().includes(slug.replace(/-/g, ' '))
      );
      console.log(`Found ${partialSlugMatches.length} games with partial slug matches`);
      if (partialSlugMatches.length > 0) {
        console.log(`Sample partial matches:`, partialSlugMatches.slice(0, 3).map(g => ({
          id: g.id,
          title: g.title,
          categoryId: g.categoryId,
          console: g.console
        })));
      }
    } else {
      console.log(`Found game: ${foundGame.title}`);
    }
    
    return foundGame;
  }

  async getConsoles(): Promise<string[]> {
    const data = await this.loadData();
    const consolesSet = new Set(data.games.map(game => game.console));
    const consoles = Array.from(consolesSet);
    return consoles.sort();
  }

  private createSlug(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/\.[^/.]+$/, "") // Remove file extension
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

}

// Create storage instance
export const storage = new MemStorage();