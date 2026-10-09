package cz.ninjamelon.bridge.velocity;

import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.text.Component;

public final class WebLinkCommand implements SimpleCommand {
  private final NinjaMelonVelocityPlugin plugin;

  public WebLinkCommand(NinjaMelonVelocityPlugin plugin) {
    this.plugin = plugin;
  }

  @Override
  public void execute(Invocation invocation) {
    if (!(invocation.source() instanceof Player player)) {
      invocation.source().sendMessage(Component.text(
          "Tento príkaz môže použiť iba hráč v hre."));
      return;
    }
    if (invocation.arguments().length != 1
        || !"link".equalsIgnoreCase(invocation.arguments()[0])) {
      player.sendMessage(Component.text("Použitie: /web link"));
      return;
    }
    plugin.createLinkCode(player, invocation.source());
  }
}