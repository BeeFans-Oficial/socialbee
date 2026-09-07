import { 
  formatNumber, 
  getPlatformColor, 
  getPlatformIcon, 
  generateShortCode, 
  slugify, 
  validateSlug, 
  maskUrl, 
  isSlugTaken 
} from "@/lib/utils";
import { PLATFORMS, THEMES, MOCK_USER, MOCK_LINKS, MOCK_ANALYTICS } from "@/lib/mock-data";
import { HexBackground } from "@/components/shared/HexBackground";
import { Logo } from "@/components/shared/Logo";

export default function UtilsTestPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bee-bg text-bee-text">
      <HexBackground density="low" />
      
      <div className="relative z-10 container mx-auto px-6 py-12">
        <h1 className="text-4xl font-bebas mb-8 text-center">
          🧪 Teste de Utilitários BeeSocial
        </h1>

        <div className="grid gap-6 max-w-6xl mx-auto">
          {/* Logo Variants */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">Logo Variants</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center gap-4 p-4 bg-bee-surface2 rounded-lg">
                <Logo variant="full" size="md" />
                <p className="text-sm text-bee-muted">Full (md)</p>
              </div>
              <div className="flex flex-col items-center gap-4 p-4 bg-bee-surface2 rounded-lg">
                <Logo variant="icon" size="lg" />
                <p className="text-sm text-bee-muted">Icon (lg)</p>
              </div>
              <div className="flex flex-col items-center gap-4 p-4 bg-bee-surface2 rounded-lg">
                <Logo variant="stacked" size="sm" />
                <p className="text-sm text-bee-muted">Stacked (sm)</p>
              </div>
            </div>
          </div>

          {/* Format Number */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">formatNumber()</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">Input: 1234</p>
                <p className="text-2xl font-bold">{formatNumber(1234)}</p>
              </div>
              <div className="p-4 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">Input: 45678</p>
                <p className="text-2xl font-bold">{formatNumber(45678)}</p>
              </div>
              <div className="p-4 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">Input: 1234567</p>
                <p className="text-2xl font-bold">{formatNumber(1234567)}</p>
              </div>
            </div>
          </div>

          {/* Platforms */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">Plataformas</h2>
            <div className="grid md:grid-cols-5 gap-3">
              {PLATFORMS.map((platform) => (
                <div 
                  key={platform.id}
                  className="p-3 bg-bee-surface2 rounded-lg text-center"
                  style={{ borderLeft: `4px solid ${platform.color}` }}
                >
                  <span className="text-2xl">{platform.icon}</span>
                  <p className="text-xs mt-1 text-bee-muted">{platform.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Themes */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">Temas</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {THEMES.map((theme) => (
                <div key={theme.id} className="p-4 bg-bee-surface2 rounded-lg">
                  <p className="font-semibold mb-2">{theme.label}</p>
                  <div className="flex gap-2">
                    {theme.preview.map((color, i) => (
                      <div 
                        key={i}
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* String Utils */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">String Utils</h2>
            <div className="space-y-3">
              <div className="p-3 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">slugify("Bella Rosa 💕")</p>
                <p className="font-mono text-bee-pink">{slugify("Bella Rosa 💕")}</p>
              </div>
              <div className="p-3 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">maskUrl("https://onlyfans.com/bella123")</p>
                <p className="font-mono text-bee-pink">{maskUrl("https://onlyfans.com/bella123")}</p>
              </div>
              <div className="p-3 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">generateShortCode()</p>
                <p className="font-mono text-bee-pink">{generateShortCode()}</p>
              </div>
              <div className="p-3 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">validateSlug("bella-rosa")</p>
                <p className="font-mono text-green-500">{validateSlug("bella-rosa") ? "✓ válido" : "✗ inválido"}</p>
              </div>
              <div className="p-3 bg-bee-surface2 rounded-lg">
                <p className="text-bee-muted text-sm">isSlugTaken("admin")</p>
                <p className="font-mono text-red-500">{isSlugTaken("admin") ? "✗ reservado" : "✓ disponível"}</p>
              </div>
            </div>
          </div>

          {/* Mock User */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">MOCK_USER</h2>
            <div className="p-4 bg-bee-surface2 rounded-lg">
              <p className="text-xl font-bold mb-2">{MOCK_USER.displayName}</p>
              <p className="text-bee-muted mb-3">{MOCK_USER.bio}</p>
              <div className="flex gap-4 text-sm">
                <span className="text-bee-muted">Slug: <span className="text-bee-pink font-mono">{MOCK_USER.slug}</span></span>
                <span className="text-bee-muted">Theme: <span className="text-bee-pink">{MOCK_USER.themeId}</span></span>
                <span className="text-bee-muted">+18: <span className="text-bee-pink">{MOCK_USER.isAdult ? "Sim" : "Não"}</span></span>
              </div>
            </div>
          </div>

          {/* Mock Links */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">MOCK_LINKS</h2>
            <div className="space-y-2">
              {MOCK_LINKS.map((link) => (
                <div 
                  key={link.id} 
                  className="p-3 bg-bee-surface2 rounded-lg flex items-center justify-between"
                  style={{ opacity: link.isActive ? 1 : 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getPlatformIcon(link.platform)}</span>
                    <div>
                      <p className="font-semibold">{link.title}</p>
                      <p className="text-xs text-bee-muted">/{link.shortCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-bee-pink">{formatNumber(link.clicks)}</p>
                    <p className="text-xs text-bee-muted">clicks</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock Analytics */}
          <div className="bg-bee-surface border border-bee-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-bee-pink">MOCK_ANALYTICS</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 bg-bee-surface2 rounded-lg text-center">
                <p className="text-3xl font-bold text-bee-pink">{formatNumber(MOCK_ANALYTICS.totalViews)}</p>
                <p className="text-sm text-bee-muted mt-1">Total Views</p>
              </div>
              <div className="p-4 bg-bee-surface2 rounded-lg text-center">
                <p className="text-3xl font-bold text-bee-pink">{formatNumber(MOCK_ANALYTICS.totalClicks)}</p>
                <p className="text-sm text-bee-muted mt-1">Total Clicks</p>
              </div>
              <div className="p-4 bg-bee-surface2 rounded-lg text-center">
                <p className="text-3xl font-bold text-bee-pink">{MOCK_ANALYTICS.conversionRate}%</p>
                <p className="text-sm text-bee-muted mt-1">Conversion Rate</p>
              </div>
              <div className="p-4 bg-bee-surface2 rounded-lg text-center">
                <p className="text-3xl font-bold text-bee-pink">{MOCK_ANALYTICS.dailyData.length}</p>
                <p className="text-sm text-bee-muted mt-1">Days of Data</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
