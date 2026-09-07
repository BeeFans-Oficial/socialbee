import { mockUser, mockLinks } from "@/lib/mock-data";
import { PhoneMockup } from "@/components/shared/PhoneMockup";

export default function DemoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">Demo BeeSocial</h1>
        <PhoneMockup>
          <div className="p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-bee-surface mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{mockUser.displayName}</h2>
            <p className="text-sm text-bee-muted mb-6">{mockUser.bio}</p>
            <div className="space-y-3">
              {mockLinks.slice(0, 4).map((link) => (
                <div
                  key={link.id}
                  className="p-4 bg-gradient-to-r from-bee-pink to-bee-pink-hot rounded-lg font-semibold"
                >
                  {link.title}
                </div>
              ))}
            </div>
          </div>
        </PhoneMockup>
      </div>
    </div>
  );
}
