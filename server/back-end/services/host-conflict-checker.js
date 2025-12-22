const HostConfigModel = require('../db/models/host-configs');

/**
 * Host冲突检测服务
 */
class HostConflictChecker {
  /**
   * 检查Host列表是否有冲突
   * @param {Array<string>} hosts - 要检查的Host列表
   * @param {number} excludeConfigId - 排除的配置ID（用于更新场景）
   * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
   */
  async checkConflict(hosts, excludeConfigId = null) {
    // 获取所有其他配置的Host列表
    const allHosts = await HostConfigModel.getAllHosts(excludeConfigId);

    const conflicts = [];
    const hostSet = new Set(hosts.map(h => h.toLowerCase()));

    // 检查每个Host是否冲突
    allHosts.forEach(({ configId, host }) => {
      if (hostSet.has(host.toLowerCase())) {
        conflicts.push({
          host,
          configId
        });
      }
    });

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * 检查Host列表并返回详细信息（包含配置名称）
   * @param {Array<string>} hosts - 要检查的Host列表
   * @param {number} excludeConfigId - 排除的配置ID
   * @returns {Promise<{hasConflict: boolean, conflicts: Array}>}
   */
  async checkConflictWithDetails(hosts, excludeConfigId = null) {
    const conflictResult = await this.checkConflict(hosts, excludeConfigId);

    if (!conflictResult.hasConflict) {
      return conflictResult;
    }

    // 获取冲突配置的详细信息
    const configDetails = await Promise.all(
      conflictResult.conflicts.map(async ({ configId }) => {
        const config = await HostConfigModel.findById(configId);
        return {
          host: conflictResult.conflicts.find(c => c.configId === configId).host,
          configId,
          configName: config ? config.name : 'Unknown'
        };
      })
    );

    return {
      hasConflict: true,
      conflicts: configDetails
    };
  }
}

module.exports = new HostConflictChecker();








