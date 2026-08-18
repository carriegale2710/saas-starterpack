# Technical Dos vs Don'ts for Your First MVP

## **DO**

- **Prioritize Speed and "Vibe Coding":** The primary goal is to ship a functional product in days or weeks, not months. Use **AI-native tools** like **Cursor** and **Windsurf** for code generation, and platforms like **Lovable** or **Bolt** to spin up an initial functional version from simple prompts.
- **Choose a Popular, "Boring" Tech Stack:** Stick to frameworks with massive community support and existing documentation so you don't get stuck on bugs. The consensus recommendation for a "money-making" stack is **Next.js** (full-stack framework), **TypeScript** (for type safety), **Tailwind CSS** (for styling), and **Shadcn UI** (for pre-built components).
- **Leverage Managed Services (BaaS):** Avoid building your own backend infrastructure. Use **Supabase** for a "one-stop-shop" (database, auth, storage) or **Convex** for a real-time database that eliminates the need for manual websocket coding.
- **Automate Authentication and Billing:** Use **Clerk** to handle both user management and integrated billing. This allows you to bypass writing hundreds of lines of complex Stripe webhook code and prevents "split brain" issues where user data is desynchronized across different systems.
- **Design for "Above the Fold":** Focus 80% of your initial design time on the **hero section** and **onboarding process**. A simple app can succeed if the value proposition is instant and the onboarding invokes emotion or personalized benefits.
- **Implement Analytics Early:** Use tools like **PostHog** or **Mixpanel** to track how users interact with your features. This data is more valuable for iterating than family or friend feedback, which can be biased.

## **DON'T**

- **Don’t Over-Engineer:** Avoid complex infrastructure like **Kubernetes, Docker, or microservices** in the beginning. These systems introduce significant maintenance overhead that distracts from building the product.
- **Don’t Aim for 100% Originality:** Avoid the "originality trap." It is often safer and faster to build a **validated idea** that already exists but make it 1% better or tailor it to a specific niche or language.
- **Don’t Self-Host Initially:** Even if it's technically cheaper to use a \$10 VPS, pay for hosted providers like **Vercel** or **Netlify**. The speed of deployment and lack of server administration are worth the cost while you are still validating demand.
- **Don’t Obsess Over the "Perfect" Framework:** Avoid analysis paralysis. If you know a stack, even if it is "boring" or less trendy, use it because **speed of development** is your biggest competitive advantage.
- **Don’t Build for Scale at Zero Users:** Do not worry about "perfectly scalable" code or full unit test coverage for an app with no users. You can refactor and optimize once you have a real scaling problem.
- **Don’t Give Away the Product for Free:** Technically and strategically, you should **charge from day one**. This forces you to build features that people actually value and prevents you from supporting users who will never become paying customers.
